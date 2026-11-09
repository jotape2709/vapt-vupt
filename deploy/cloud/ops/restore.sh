#!/usr/bin/env bash
# Restaura um backup cifrado num projeto Compose NOVO e VAZIO e verifica o resultado.
# Serve ao ensaio de restauração (projeto separado, sem proxy, descartado ao fim) e à recuperação
# real num servidor substituto (com --env do cofre e --with-proxy). Nunca grava sobre dados existentes.
#
#   ops/restore.sh --backup DIR --identity ARQ_CHAVE_AGE [--env ARQ] [--project NOME] [--with-proxy] [--keep]
#
#   --backup    diretório com *.age e SHA256SUMS (baixe antes com rclone copy offsite:.../<carimbo> DIR)
#   --identity  chave PRIVADA age (fica com o fornecedor; nunca no servidor de produção)
#   --env       ambiente do destino. Sem ele: ensaio com segredos aleatórios descartáveis.
#   --project   nome do projeto Compose de destino (padrão vv-restore-<carimbo>)
#   --with-proxy  sobe também o Caddy (recuperação real; exige DNS e portas 80/443)
#   --keep      mantém o ambiente restaurado (sem --keep, ensaio é destruído ao final)
source "$(dirname "$0")/lib.sh"
backup="" identity="" envfile="" project="" proxy=0 keep=0
while [ $# -gt 0 ]; do case "$1" in
 --backup) backup="$2"; shift 2;; --identity) identity="$2"; shift 2;; --env) envfile="$2"; shift 2;;
 --project) project="$2"; shift 2;; --with-proxy) proxy=1; shift;; --keep) keep=1; shift;;
 *) die "opção desconhecida: $1";; esac; done
[ -d "$backup" ] && [ -f "$identity" ] || die "informe --backup DIR e --identity ARQ"
command -v age >/dev/null && command -v python3 >/dev/null || die "age e python3 são necessários"
backup=$(cd "$backup" && pwd)

log "Conferindo integridade (SHA256SUMS)"
(cd "$backup" && sha256sum -c --quiet SHA256SUMS) || die "arquivos do backup corrompidos ou incompletos"
manifest=$(age -d -i "$identity" "$backup/manifest.json.age") || die "não foi possível decifrar com esta chave"
mf() { python3 -I -c 'import json,sys
v=json.loads(sys.argv[1])
for k in sys.argv[2].split("."): v=v.get(k) if isinstance(v,dict) else None
print(" ".join(v) if isinstance(v,dict) else ("null" if v is None else v))' "$manifest" "$1"; }
log "Backup $(mf createdAt) do projeto $(mf project), schema $(mf schemaVersion), imagem $(mf appImage)"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
if [ -z "$envfile" ]; then
 rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-40; }
 envfile="$tmp/restore.env"
 cat > "$envfile" <<ENV
VV_PROJECT=${project:-vv-restore-$(date -u +%Y%m%d%H%M%S)}
VV_APP_IMAGE=$(mf appImage)
VV_APP_ORIGIN=$(mf appOrigin)
VV_AUTH_ORIGIN=$(mf authOrigin)
VV_ACME_EMAIL=restore-drill@example.invalid
VV_POSTGRES_PASSWORD=$(rnd)
VV_MIGRATOR_PASSWORD=$(rnd)
VV_RUNTIME_PASSWORD=$(rnd)
VV_KEYCLOAK_DB_PASSWORD=$(rnd)
VV_KEYCLOAK_BOOTSTRAP_PASSWORD=$(rnd)
VV_OIDC_CLIENT_SECRET=$(rnd)
VV_KC_ADMIN_PORT=${VV_KC_ADMIN_PORT:-18081}
ENV
 log "Ensaio: segredos aleatórios descartáveis (login real não é testado sem o .env original)"
fi
VV_ENV_FILE="$envfile"; load_env
[ -n "$project" ] && VV_PROJECT="$project"
live="${VV_LIVE_PROJECT:-vapt-vupt}"
[ "$proxy" = 1 ] || [ "$VV_PROJECT" != "$live" ] || die "o ensaio não pode usar o nome do projeto de produção ($live)"
if docker volume inspect "${VV_PROJECT}_pgdata" >/dev/null 2>&1; then die "o volume ${VV_PROJECT}_pgdata já existe: restauração só em ambiente vazio"; fi
log "Destino: projeto $VV_PROJECT"

dc up -d postgres
wait_healthy postgres 40
for db in vapt_vupt keycloak; do
 log "Restaurando $db"
 age -d -i "$identity" "$backup/$db.dump.age" | dc exec -T -u postgres postgres pg_restore -d "$db" --exit-on-error --single-transaction
done

log "Migrations (esperado: nada a aplicar se a imagem for a do backup)"
dc --profile ops run --rm migrate

log "Verificando dados restaurados"
fail=0
for t in $(mf rowCounts); do
 want=$(mf "rowCounts.$t"); got=$(psql_super -d vapt_vupt -c "SELECT count(*) FROM public.\"$t\"")
 [ "$want" = "$got" ] && echo "  ✓ $t: $got" || { echo "  ✗ $t: esperado $want, obtido $got"; fail=1; }
done
schema=$(psql_super -d vapt_vupt -c "SELECT max(version) FROM schema_migrations")
[ "$schema" = "$(mf schemaVersion)" ] && echo "  ✓ schema $schema" || { echo "  ✗ schema $schema (backup: $(mf schemaVersion))"; fail=1; }
rls=$(psql_super -d vapt_vupt -c "SELECT coalesce(string_agg(relname, ',' ORDER BY relname),'') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' AND relrowsecurity AND relforcerowsecurity")
[ -n "$rls" ] && [ "$rls" = "$(mf rlsForced)" ] && echo "  ✓ RLS forçada nas mesmas tabelas do backup: $rls" || { echo "  ✗ RLS forçada em: $rls (backup: $(mf rlsForced))"; fail=1; }
owners=$(psql_super -d vapt_vupt -c "SELECT string_agg(DISTINCT pg_get_userbyid(relowner), ',') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r'")
[ "$owners" = vv_migrator ] && echo "  ✓ tabelas pertencem a vv_migrator" || { echo "  ✗ donos: $owners"; fail=1; }
kc=$(psql_super -d keycloak -c "SELECT count(*) FROM user_entity u JOIN realm r ON r.id=u.realm_id WHERE r.name='vapt'")
[ "$kc" = "$(mf keycloakUsers)" ] && echo "  ✓ usuários do realm vapt: $kc" || { echo "  ✗ usuários do realm: $kc (backup: $(mf keycloakUsers))"; fail=1; }

log "Subindo Keycloak e aplicação sobre os dados restaurados"
if [ "$proxy" = 1 ]; then dc up -d --wait --wait-timeout 300; else dc up -d --wait --wait-timeout 300 keycloak app; fi
dc exec -T app node -e "fetch('http://127.0.0.1:3001/ready').then(r=>r.json()).then(j=>console.log('  ✓ /ready: '+j.status))"
dc exec -T app node -e "fetch('http://keycloak:8080/realms/vapt/.well-known/openid-configuration').then(r=>r.json()).then(j=>console.log('  ✓ realm vapt restaurado; emissor '+j.issuer))"

[ "$fail" = 0 ] || { log "VERIFICAÇÃO FALHOU (ambiente mantido para análise: projeto $VV_PROJECT)"; exit 1; }
if [ "$keep" = 1 ]; then log "Restauração verificada. Ambiente mantido: projeto $VV_PROJECT"
else dc down -v --remove-orphans >/dev/null 2>&1; log "Restauração verificada. Ambiente de ensaio removido."; fi
