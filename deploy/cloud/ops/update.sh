#!/usr/bin/env bash
# Atualização da aplicação para uma nova imagem com versão fixa.
#
#   ops/update.sh registro/vapt-vupt-app:0.3.1
#   ops/update.sh registro/vapt-vupt-app:0.4.0 --sem-reversao --plano-recuperacao ARQ
#
# Ordem: preflight → verificação pública ANTES (pré-condição) → plano de migrations e compatibilidade
# → backup → migrations → troca da aplicação → verificação pública OBRIGATÓRIA → registro.
#
# Compatibilidade (docs/cloud/OPERACAO.md#atualização-e-reversão): "migration aditiva" não prova
# nada. Cada migration nova declara se a versão ANTERIOR funciona sobre o schema novo, e a
# declaração "sim" exige o teste scripts/compat-previous.sh aprovado. Se alguma migration pendente
# não for declarada compatível, reverter só a imagem NÃO é seguro: o script para, e só prossegue com
# --sem-reversao e um plano de recuperação escrito (normalmente: restaurar o backup tirado aqui).
#
# Saída (nunca anuncia sucesso sem a verificação pública):
#   0  atualizado e verificado publicamente
#   1  a NOVA VERSÃO falhou (saúde interna ou verificação pública); revertida e verificada
#   2  falha FORA da nova versão (rede, DNS, proxy, Keycloak, banco): reverter não resolveu
#   3  recusado antes de qualquer mudança: o serviço já falhava na verificação pública
#   4  recusado antes de qualquer mudança: migration sem compatibilidade com a versão anterior
#   5  falhou numa atualização sem reversão: NADA foi revertido; seguir o plano de recuperação
source "$(dirname "$0")/lib.sh"
new="" no_rollback=0 plan=""
while [ $# -gt 0 ]; do case "$1" in
 --sem-reversao) no_rollback=1; shift;;
 --plano-recuperacao) plan="${2:-}"; shift 2;;
 -*) die "opção desconhecida: $1";;
 *) [ -z "$new" ] || die "informe uma só imagem"; new="$1"; shift;; esac; done
[ -n "$new" ] || die "informe a nova imagem (registro/nome:versão)"
[[ "${new##*/}" == *:* ]] || die "imagem sem versão"
[[ "$new" != *:latest* ]] || die "não use latest"
"$(dirname "$0")/preflight.sh"
load_env
old="$VV_APP_IMAGE"
[ "$old" != "$new" ] || die "a imagem informada já está em uso"
wait_s="${VV_UPDATE_WAIT:-180}"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
release() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $old -> $new $*" >> "$VV_CLOUD_DIR/releases.log"; }
log "Atualização $old -> $new"

# Verificação pública: o caminho que o cliente usa (DNS, TLS, proxy, API, banco e login no Keycloak).
# Imprime o motivo da falha. Não cria sessão nem usa senha.
public_check() {
 local code loc
 code=$(pcurl -s -o "$tmp/ready" -w '%{http_code}' -m 10 "$VV_APP_ORIGIN/ready" 2>/dev/null) || code=000
 { [ "$code" = 200 ] && grep -q '"ready"' "$tmp/ready"; } || { echo "aplicação: $VV_APP_ORIGIN/ready respondeu HTTP $code"; return 1; }
 loc=$(pcurl -s -o /dev/null -w '%{http_code} %{redirect_url}' -m 10 "$VV_APP_ORIGIN/auth/login" 2>/dev/null) || loc=000
 case "$loc" in "302 $VV_AUTH_ORIGIN/realms/vapt/protocol/openid-connect/auth?"*client_id=*) ;;
  *) echo "login: $VV_APP_ORIGIN/auth/login respondeu HTTP ${loc%% *} sem redirecionar ao provedor"; return 1;; esac
 code=$(pcurl -s -o "$tmp/login" -w '%{http_code}' -m 15 "${loc#* }" 2>/dev/null) || code=000
 { [ "$code" = 200 ] && grep -q 'name="password"' "$tmp/login"; } || { echo "login: página do Keycloak em $VV_AUTH_ORIGIN respondeu HTTP $code"; return 1; }
}
wait_public() { # tentativas (5 s cada)
 local why=""; for _ in $(seq 1 "${1:-12}"); do why=$(public_check) && return 0; sleep 5; done; echo "$why"; return 1
}
diagnose() { # estado das dependências, sem valores sensíveis
 local s id; for s in postgres keycloak app caddy; do
  id=$(dc ps -aq "$s" 2>/dev/null); echo "   $s: $([ -n "$id" ] && docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$id" || echo ausente)"
 done
}
# --no-deps: a troca mexe só na aplicação; nunca religa nem recria banco, Keycloak ou proxy.
switch_to() { VV_APP_IMAGE="$1" dc up -d --no-deps --wait --wait-timeout "$wait_s" app; }

log "1/6 Verificação pública ANTES de mudar qualquer coisa"
if ! why=$(wait_public 3); then
 diagnose
 log "RECUSADO: o serviço já falha na verificação pública ($why). Isso não é causado pela nova versão e uma atualização não resolve. Nada foi alterado."
 exit 3
fi

log "2/6 Plano de migrations e compatibilidade com a versão em uso"
docker image inspect "$new" >/dev/null 2>&1 || docker pull "$new"
docker run --rm --entrypoint sh "$new" -c 'for f in /app/db/migrations/*.sql; do printf "%s\t%s\n" "$(basename "$f")" "$(grep -m1 -iE "^--[[:space:]]*compatibilidade-anterior:" "$f")"; done' > "$tmp/migrations.tsv"
applied=$(psql_super -d vapt_vupt -c "SELECT coalesce(string_agg(version, ' ' ORDER BY version), '') FROM schema_migrations")
plan_out=$(python3 -I - "$tmp/migrations.tsv" "$applied" <<'PY'
import re, sys
applied = set(sys.argv[2].split())
rows = [l.rstrip("\n").split("\t", 1) for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
known = {f[:3] for f, _ in rows}
header = re.compile(r"^--\s*compatibilidade-anterior:\s*(sim|não)(?=$|[\s—-])", re.I)
unsafe = 0
for f, h in rows:
    if f[:3] in applied: continue
    m = header.match(h or ""); c = m.group(1).lower() if m else "não declarada"
    unsafe += c != "sim"
    print(f"   pendente {f}: compatibilidade com a versão anterior = {c}")
for v in sorted(applied - known):
    print(f"   ATENÇÃO: o banco tem a migration {v}, desconhecida pela nova imagem (rebaixamento?)"); unsafe += 1
print(f"UNSAFE={unsafe}")
PY
)
grep -v '^UNSAFE=' <<<"$plan_out" || echo "   nenhuma migration pendente"
reversible=1; [ "$(grep -o 'UNSAFE=[0-9]*' <<<"$plan_out" | cut -d= -f2)" = 0 ] || reversible=0
if [ "$reversible" = 0 ]; then
 if [ "$no_rollback" != 1 ] || [ ! -s "$plan" ]; then
  log "RECUSADO: há migration não declarada compatível com $old. Depois dela, reverter só a imagem não é seguro."
  log "Para prosseguir: agende janela, escreva o plano de recuperação (ex.: restaurar o backup desta atualização) e rode com --sem-reversao --plano-recuperacao ARQ. Nada foi alterado."
  exit 4
 fi
 log "Sem reversão de imagem nesta atualização. Plano de recuperação: $plan"
elif [ "$no_rollback" = 1 ]; then log "--sem-reversao informado: falhas NÃO serão revertidas automaticamente"; reversible=0
fi

log "3/6 Backup antes de mudar qualquer coisa"
"$(dirname "$0")/backup.sh" ${VV_UPDATE_BACKUP_ARGS:-} > "$tmp/backup.out" 2>&1 || { cat "$tmp/backup.out"; die "backup falhou; nada foi alterado"; }
cat "$tmp/backup.out"; bdir=$(tail -1 "$tmp/backup.out")
log "Backup desta atualização: $bdir"

if [ "$reversible" = 0 ]; then
 log "Parando a aplicação: a versão $old não deve operar sobre o schema novo"
 dc stop app >/dev/null
fi
log "4/6 Migrations com a nova versão (transação única: falha = nada aplicado)"
if ! VV_APP_IMAGE="$new" dc --profile ops run --rm migrate; then
 [ "$reversible" = 1 ] || dc start app >/dev/null
 release "FALHOU nas migrations (nada aplicado)"; die "migrations falharam e foram desfeitas; $old continua em uso"
fi

fail_without_rollback() {
 diagnose; release "FALHOU sem reversão ($1)"
 log "FALHA SEM REVERSÃO: $1"
 log "A imagem anterior NÃO foi religada (schema incompatível). Siga o plano de recuperação: $plan"
 log "Backup anterior à atualização: $bdir (restauração: docs/cloud/OPERACAO.md)"
 exit 5
}
rollback() { # motivo
 local cause="$1" why
 if [ "$reversible" = 0 ]; then fail_without_rollback "$cause"; fi
 log "Voltando para $old ($cause)"
 dc logs --tail 30 app 2>&1 | sed 's/^/   /' || true
 if switch_to "$old" && why=$(wait_public 12); then
  release "FALHOU, revertido ($cause)"
  log "A NOVA VERSÃO falhou: $cause. Revertido para $old e verificado publicamente."
  exit 1
 fi
 why="${why:-a versão anterior também não ficou saudável internamente}"
 diagnose; release "FALHOU; reverter não resolveu ($why)"
 log "FALHA FORA DA NOVA VERSÃO: com $old a verificação também falha ($why). Reverter não resolve:"
 log "confira DNS, certificado, proxy, Keycloak e banco (estado acima). A imagem em uso é $old."
 exit 2
}

log "5/6 Trocando a aplicação"
switch_to "$new" || rollback "a nova versão não ficou saudável internamente em ${wait_s}s"

log "6/6 Verificação pública obrigatória"
# Nada de "dc up" aqui: o .env ainda aponta a imagem anterior, e recriar dependentes religaria a
# aplicação antiga e faria a verificação aprovar a versão errada (achado do ensaio).
if ! why=$(wait_public 12); then rollback "verificação pública: $why"; fi
sed -i "s#^VV_APP_IMAGE=.*#VV_APP_IMAGE=$new#" "$VV_ENV_FILE"
release "ok"
log "Atualizado para $new e verificado publicamente (aplicação, banco e página de login)."
