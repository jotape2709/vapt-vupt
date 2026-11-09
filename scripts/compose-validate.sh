#!/usr/bin/env bash
# Validação da instalação de DESENVOLVIMENTO pelo Docker Compose (docs/LOCAL-DEV.md).
# Sobe tudo do zero, provisiona e confere: readiness, emissor e redirects OIDC, papéis do banco,
# falha explícita sem configuração e recusa de papel privilegiado. Não substitui os testes e2e.
#
#   VV_COMPOSE_CLEAN=1   apaga os volumes deste ambiente antes (instalação limpa)
#   VV_COMPOSE_BUILD=0   não reconstrói a imagem (use quando ela já foi construída à parte)
set -euo pipefail
cd "$(dirname "$0")/.."
dc() { docker compose "$@"; }
step() { printf '\n== %s\n' "$*"; }
fail() { echo "FALHOU: $*" >&2; exit 1; }
ISSUER=http://localhost:8080/realms/vapt
APP=http://localhost:3001

if [ "${VV_COMPOSE_CLEAN:-0}" = 1 ]; then step "Removendo volumes do ambiente de desenvolvimento"; dc down -v --remove-orphans; fi

step "Subindo postgres, keycloak, migrate e app (espera os healthchecks)"
build=--build; [ "${VV_COMPOSE_BUILD:-1}" = 0 ] && build=--no-build
start=$(date +%s)
dc up -d $build --wait
echo "Pronto em $(( $(date +%s) - start ))s"
[ "$(dc ps -a --format '{{.State}} {{.ExitCode}}' migrate)" = "exited 0" ] || fail "migração não terminou com sucesso"
dc logs migrate | tail -5

step "Seed de exemplo (idempotente) e provisionamento documentado"
dc --profile tools run --rm seed
dc --profile tools run --rm seed >/dev/null   # segunda execução não duplica
out=$(dc --profile tools run --rm admin provision --name "Bar de Validação" --segment bar --unit "Salão" \
  --owner-issuer "$ISSUER" --owner-subject "validation-only-$(date +%s)")
echo "$out"
echo "$out" | grep -q '"organizationId"' || fail "provision não devolveu organizationId"

step "Readiness e páginas"
curl -fsS "$APP/health"; echo
curl -fsS "$APP/ready"; echo
for path in / /demo /app; do code=$(curl -s -o /dev/null -w '%{http_code}' "$APP$path"); echo "$path -> $code"; [ "$code" = 200 ] || fail "$path"; done
[ "$(curl -s -o /dev/null -w '%{http_code}' "$APP/api/session")" = 401 ] || fail "/api/session sem cookie deveria ser 401"

step "OIDC: emissor visto pelo navegador e pela API, redirects"
issuer=$(curl -fsS "$ISSUER/.well-known/openid-configuration" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).issuer))')
echo "issuer=$issuer"; [ "$issuer" = "$ISSUER" ] || fail "issuer divergente"
location=$(curl -s -o /dev/null -w '%{redirect_url}' "$APP/auth/login")
echo "login -> ${location%%\?*}"
case "$location" in "$ISSUER/protocol/openid-connect/auth?"*) ;; *) fail "login não redireciona ao emissor";; esac
for p in "redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fcallback" "code_challenge_method=S256" "response_type=code" "state=" "nonce="; do
 case "$location" in *"$p"*) echo "  ok: $p";; *) fail "parâmetro ausente: $p";; esac
done
dc exec -T app node -e "fetch('http://keycloak:8080/realms/vapt/.well-known/openid-configuration').then(r=>r.json()).then(j=>{console.log('API alcança o provedor pela rede interna; issuer='+j.issuer)})"

step "Papéis do banco"
dc exec -T postgres psql -U postgres -d vapt_vupt -At -F ' | ' -c \
 "SELECT rolname, 'super='||rolsuper, 'bypassrls='||rolbypassrls, 'login='||rolcanlogin FROM pg_roles WHERE rolname IN ('vv_migrator','vv_app','vv_runtime') ORDER BY 1"
dc exec -T postgres psql -U postgres -d vapt_vupt -At -c \
 "SELECT 'tabelas do schema public pertencem a: '||string_agg(DISTINCT pg_get_userbyid(relowner), ',') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r'"
users=$(dc exec -T postgres psql -U postgres -d vapt_vupt -At -c "SELECT string_agg(DISTINCT usename, ',') FROM pg_stat_activity WHERE datname='vapt_vupt' AND application_name='' AND usename<>'postgres'")
echo "conexões da aplicação: $users"; [ "$users" = vv_runtime ] || fail "a API deveria conectar só como vv_runtime"

step "Queda do banco não derruba a API"
started=$(docker inspect -f '{{.State.StartedAt}}' "$(dc ps -q app)")
dc restart postgres
for i in $(seq 1 60); do curl -sf "$APP/ready" >/dev/null && break; sleep 1; done
curl -fsS "$APP/ready"; echo
[ "$(docker inspect -f '{{.State.StartedAt}} {{.RestartCount}}' "$(dc ps -q app)")" = "$started 0" ] || fail "a API reiniciou depois da queda do banco"
echo "API seguiu no mesmo processo e voltou a responder após reiniciar o PostgreSQL."

step "Falha explícita sem configuração obrigatória"
if msg=$(dc run --rm --no-deps -e OIDC_CLIENT_SECRET= app 2>&1); then fail "API iniciou sem OIDC_CLIENT_SECRET"; fi
echo "$msg" | grep -m1 -E 'OIDC_CLIENT_SECRET' || fail "mensagem não cita a variável ausente"
if msg=$(dc run --rm --no-deps -e DATABASE_URL=postgresql://vv_migrator@postgres:5432/vapt_vupt -e DATABASE_PASSWORD="${VV_MIGRATOR_PASSWORD:-dev-only-migrator}" app 2>&1); then fail "API iniciou com papel dono das tabelas"; fi
echo "$msg" | grep -m1 'papel restrito' || fail "mensagem de papel restrito ausente"

echo; echo "Compose de desenvolvimento validado."
