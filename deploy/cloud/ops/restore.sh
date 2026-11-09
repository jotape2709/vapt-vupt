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
print(json.dumps(v) if isinstance(v,(dict,list)) else ("null" if v is None else v))' "$manifest" "$1"; }
[ "$(mf format)" = 2 ] || die "formato de manifesto $(mf format) não suportado (esperado 2)"
log "Backup $(mf createdAt) do projeto $(mf project) (modo $(mf mode)), schema $(mf vapt.schemaVersion), imagem $(mf appImage)"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
if [ -z "$envfile" ]; then
 rnd() { "$(dirname "$0")/gen-secret.sh"; }
 envfile="$tmp/restore.env"
 cat > "$envfile" <<ENV
VV_PROJECT=${project:-vv-restore-$(date -u +%Y%m%d%H%M%S)}
VV_APP_IMAGE=$(mf appImage)
VV_APP_ORIGIN=$(mf appOrigin)
VV_AUTH_ORIGIN=$(mf authOrigin)
VV_ACME_EMAIL=restore-drill@example.invalid
VV_POSTGRES_PASSWORD='$(rnd)'
VV_MIGRATOR_PASSWORD='$(rnd)'
VV_RUNTIME_PASSWORD='$(rnd)'
VV_KEYCLOAK_DB_PASSWORD='$(rnd)'
VV_KEYCLOAK_BOOTSTRAP_PASSWORD='$(rnd)'
VV_OIDC_CLIENT_SECRET='$(rnd)'
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

log "Verificando os dados restaurados contra o manifesto (mesmo snapshot do dump)"
fail=0
got=$(psql_super -d vapt_vupt -f - < "$VV_CLOUD_DIR/ops/invariants.sql")
python3 -I - "$(mf vapt)" "$got" <<'PY' || fail=1
import json, sys
want, got = json.loads(sys.argv[1]), json.loads(sys.argv[2])
bad = 0
for key in sorted(set(want) | set(got)):
    if key == "rowCounts":
        for t in sorted(set(want[key]) | set(got.get(key, {}))):
            w, g = want[key].get(t), got.get(key, {}).get(t)
            print(f"  {'✓' if w == g else '✗'} {t}: {g}" + ("" if w == g else f" (backup: {w})")); bad += w != g
    else:
        ok = want.get(key) == got.get(key)
        print(f"  {'✓' if ok else '✗'} {key}: {got.get(key)}" + ("" if ok else f" (backup: {want.get(key)})")); bad += not ok
for key in ("stockMismatches", "chainBreaks"):
    if got.get(key):
        print(f"  ✗ invariante violado: {key}={got[key]}"); bad += 1
if got.get("tableOwners") != "vv_migrator":
    print(f"  ✗ donos das tabelas: {got.get('tableOwners')}"); bad += 1
sys.exit(1 if bad else 0)
PY
kc_ids=$(psql_super -d keycloak -c "SELECT coalesce(string_agg(u.id, ' ' ORDER BY u.id), '') FROM user_entity u JOIN realm r ON r.id=u.realm_id WHERE r.name='vapt'")
kc_users=$(wc -w <<<"$kc_ids" | tr -d ' '); kc_hash=$(printf '%s' "$kc_ids" | sha256sum | cut -c1-16)
[ "$kc_users" = "$(mf keycloak.realmUsers)" ] && [ "$kc_hash" = "$(mf keycloak.userIdsSha256)" ] \
 && echo "  ✓ usuários do realm vapt: $kc_users (mesmos ids)" || { echo "  ✗ usuários do realm: $kc_users (backup: $(mf keycloak.realmUsers))"; fail=1; }
issuer=$(mf authOrigin)/realms/vapt
members=$(psql_super -d vapt_vupt -v iss="$issuer" -f - <<'SQL'
SELECT coalesce(string_agg(DISTINCT subject, ' ' ORDER BY subject), '') FROM memberships WHERE issuer = :'iss';
SQL
)
orphans=$(comm -23 <(tr ' ' '\n' <<<"$members" | grep . | sort) <(tr ' ' '\n' <<<"$kc_ids" | grep . | sort) | grep -c . || true)
if [ "$orphans" = "$(mf orphanMemberships)" ]; then
 echo "  ✓ funções sem usuário no Keycloak: $orphans (igual ao backup)"
else echo "  ✗ funções sem usuário no Keycloak: $orphans (backup: $(mf orphanMemberships), modo $(mf mode))"; fail=1; fi

log "Migrations (esperado: nada a aplicar se a imagem for a do backup)"
dc --profile ops run --rm migrate

log "Subindo Keycloak e aplicação sobre os dados restaurados"
if [ "$proxy" = 1 ]; then dc up -d --wait --wait-timeout 300; else dc up -d --wait --wait-timeout 300 keycloak app; fi
dc exec -T app node -e "fetch('http://127.0.0.1:3001/ready').then(r=>r.json()).then(j=>console.log('  ✓ /ready: '+j.status))"
dc exec -T app node -e "fetch('http://keycloak:8080/realms/vapt/.well-known/openid-configuration').then(r=>r.json()).then(j=>console.log('  ✓ realm vapt restaurado; emissor '+j.issuer))"

[ "$fail" = 0 ] || { log "VERIFICAÇÃO FALHOU (ambiente mantido para análise: projeto $VV_PROJECT)"; exit 1; }
if [ "$keep" = 1 ]; then log "Restauração verificada. Ambiente mantido: projeto $VV_PROJECT"
else dc down -v --remove-orphans >/dev/null 2>&1; log "Restauração verificada. Ambiente de ensaio removido."; fi
