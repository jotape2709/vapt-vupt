#!/usr/bin/env bash
# ENSAIO ISOLADO da instalação em nuvem, numa máquina com Docker (sem domínio, sem provedor, sem custo):
#  instalação limpa com proxy TLS (CA de teste) → login OIDC real no navegador → dados → falhas e
#  reinícios → backup cifrado num "armazenamento externo" falso (rclone serve s3) → atualização e
#  reversão → perda total do servidor → ensaio de restauração em projeto separado → recuperação com
#  os segredos do cofre e novo login. Tudo com segredos aleatórios descartáveis.
#
#   bash deploy/cloud/test/drill.sh
#   VV_DRILL_IMAGE=vapt-vupt-app:x   usa uma imagem já construída
#   VV_DRILL_BUILD_ARGS="--network host --secret id=extra_ca,src=/root/.ccr/ca-bundle.crt"
#   VV_DRILL_KEEP=1                  mantém o ambiente ao final
# Requisitos: docker compose v2, age, openssl, python3, node + dependências do repositório (npm ci) e
# Chromium do Playwright (PLAYWRIGHT_CHROMIUM_PATH). Acrescenta app/auth.vv-drill.test em /etc/hosts.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../../.." && pwd)"; cloud="$repo/deploy/cloud"
work="${VV_DRILL_WORK:-$(mktemp -d /tmp/vv-drill.XXXXXX)}"; mkdir -p "$work"; chmod 700 "$work"
report="$work/report.txt"; : > "$report"
t0=$(date +%s)
step() { printf '\n=== %s\n' "$*"; echo "[$(( $(date +%s) - t0 ))s] $*" >> "$report"; }
note() { echo "$*"; echo "    $*" >> "$report"; }
fail() { echo "ENSAIO FALHOU: $*" >&2; echo "FALHOU: $*" >> "$report"; exit 1; }
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-40; }
APP=https://app.vv-drill.test:8443 AUTH=https://auth.vv-drill.test:8443
RCLONE_IMAGE="${VV_RCLONE_IMAGE:-rclone/rclone:1.71}"
# Os nomes do ensaio resolvem para 127.0.0.1 e nunca passam por proxy de saída.
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}.vv-drill.test,127.0.0.1,localhost" no_proxy="${no_proxy:+$no_proxy,}.vv-drill.test,127.0.0.1,localhost"

step "Preparação (trabalho em $work)"
grep -q 'app.vv-drill.test' /etc/hosts || echo '127.0.0.1 app.vv-drill.test auth.vv-drill.test' >> /etc/hosts
image="${VV_DRILL_IMAGE:-}"
if [ -z "$image" ]; then
 image="vapt-vupt-app:drill-$(git -C "$repo" rev-parse --short HEAD)"
 # shellcheck disable=SC2086
 docker build ${VV_DRILL_BUILD_ARGS:-} -f "$cloud/Dockerfile" --build-arg VV_VERSION="${image##*:}" -t "$image" "$repo" >"$work/build.log" 2>&1 || { tail -30 "$work/build.log"; fail "build da imagem"; }
fi
note "imagem: $image ($(docker image inspect -f '{{.Size}}' "$image" | awk '{printf "%.0f MB", $1/1e6}'))"
mkdir -p "$work/ca"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 30 -nodes -subj "/CN=Vapt-Vupt drill CA" \
 -addext basicConstraints=critical,CA:TRUE -addext keyUsage=critical,keyCertSign,cRLSign \
 -keyout "$work/ca/root.key" -out "$work/ca/root.crt" 2>/dev/null
chmod 644 "$work/ca/root.key"   # lida pelo Caddy no contêiner; CA descartável, só do ensaio
age-keygen -o "$work/age-identity.txt" 2>/dev/null; recipient=$(age-keygen -y "$work/age-identity.txt")

# "Armazenamento externo" falso: servidor S3 do rclone num volume próprio.
docker rm -f vv-drill-offsite >/dev/null 2>&1 || true
docker volume rm vv-drill-offsite >/dev/null 2>&1 || true
offkey=$(rnd) offsecret=$(rnd)
docker run -d --name vv-drill-offsite -p 127.0.0.1:19000:8080 -v vv-drill-offsite:/srv "$RCLONE_IMAGE" \
 serve s3 /srv --addr :8080 --auth-key "$offkey,$offsecret" >/dev/null
cat > "$work/backup.env" <<ENV
RCLONE_CONFIG_OFFSITE_TYPE=s3
RCLONE_CONFIG_OFFSITE_PROVIDER=Rclone
RCLONE_CONFIG_OFFSITE_ENDPOINT=http://127.0.0.1:19000
RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID=$offkey
RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY=$offsecret
RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET=true
ENV
chmod 600 "$work/backup.env"
docker run --rm --entrypoint mkdir -v vv-drill-offsite:/srv "$RCLONE_IMAGE" -p /srv/vv-drill-backups   # o "bucket"

kc_admin_pw=$(rnd)
cat > "$work/drill.env" <<ENV
VV_PROJECT=vv-drill
VV_APP_IMAGE=$image
VV_APP_ORIGIN=$APP
VV_AUTH_ORIGIN=$AUTH
VV_ACME_EMAIL=drill@example.invalid
VV_POSTGRES_PASSWORD=$(rnd)
VV_MIGRATOR_PASSWORD=$(rnd)
VV_RUNTIME_PASSWORD=$(rnd)
VV_KEYCLOAK_DB_PASSWORD=$(rnd)
VV_KEYCLOAK_BOOTSTRAP_ADMIN=bootstrap-admin
VV_KEYCLOAK_BOOTSTRAP_PASSWORD=$kc_admin_pw
VV_OIDC_CLIENT_SECRET=$(rnd)
VV_KC_ADMIN_PORT=18080
VV_BACKUP_AGE_RECIPIENT=$recipient
VV_BACKUP_DIR=$work/backups
VV_BACKUP_REMOTE=offsite:vv-drill-backups/vapt-vupt
VV_DRILL_CA_DIR=$work/ca
ENV
chmod 600 "$work/drill.env"
export VV_ENV_FILE="$work/drill.env" VV_BACKUP_ENV_FILE="$work/backup.env" VV_ALLOW_TEST_DOMAINS=1 \
 VV_COMPOSE_EXTRA="-f $cloud/test/compose.drill.yaml" VV_CURL_CACERT="$work/ca/root.crt" VV_LIVE_PROJECT=vv-drill
# shellcheck disable=SC1091
source "$cloud/ops/lib.sh"; load_env
docker compose -p vv-drill --project-directory "$cloud" down -v --remove-orphans >/dev/null 2>&1 || true

step "Recusas: modelo não preenchido e senha de desenvolvimento"
cp "$cloud/.env.example" "$work/example.env"; chmod 600 "$work/example.env"
if VV_ENV_FILE="$work/example.env" "$cloud/ops/preflight.sh" > "$work/preflight-example.log" 2>&1; then fail "preflight aceitou o modelo"; fi
note "preflight recusou .env.example: $(grep -c '✗' "$work/preflight-example.log") problemas apontados"
sed "s/^VV_PROJECT=.*/VV_PROJECT=vv-drill-neg/; s/^VV_RUNTIME_PASSWORD=.*/VV_RUNTIME_PASSWORD=dev-only-runtime/" "$work/drill.env" > "$work/neg.env"; chmod 600 "$work/neg.env"
if VV_ENV_FILE="$work/neg.env" "$cloud/ops/preflight.sh" > "$work/preflight-neg.log" 2>&1; then fail "preflight aceitou senha de desenvolvimento"; fi
VV_ENV_FILE="$work/neg.env" bash -c "source '$cloud/ops/lib.sh'; load_env; dc up -d postgres >/dev/null 2>&1; sleep 8; dc logs postgres 2>&1 | grep -m1 'init: VV_RUNTIME_PASSWORD' ; dc down -v >/dev/null 2>&1" > "$work/neg-init.log" || true
grep -q 'init: VV_RUNTIME_PASSWORD' "$work/neg-init.log" || fail "init do PostgreSQL aceitou senha de desenvolvimento"
note "init do PostgreSQL recusou senha de desenvolvimento: $(cat "$work/neg-init.log" | sed 's/^.*| //')"

step "Instalação limpa (ops/install.sh)"
s=$(date +%s); "$cloud/ops/install.sh" > "$work/install.log" 2>&1 || { tail -40 "$work/install.log"; fail "install.sh"; }
note "install.sh concluído em $(( $(date +%s) - s ))s (inclui primeiro start do Keycloak)"
grep -E 'Preflight aprovado|Instalação concluída' "$work/install.log" | sed 's/^/    /' | tee -a "$report"

step "Exposição de rede"
published=$(docker ps --filter label=com.docker.compose.project=vv-drill --format '{{.Names}} {{.Ports}}')
echo "$published"
echo "$published" | grep postgres | grep -q -- '->' && fail "PostgreSQL publicado"
echo "$published" | grep app- | grep -q -- '->' && fail "API publicada sem o proxy"
note "portas: só Caddy (127.0.0.1:8443 no ensaio; 80/443 em produção) e console Keycloak em 127.0.0.1; banco e API sem porta"
code=$(pcurl -s -o /dev/null -w '%{http_code}' "$AUTH/admin/master/console/"); [ "$code" = 404 ] || fail "console admin público ($code)"
note "console administrativo pelo domínio público: HTTP $code"
users=$(psql_super -d vapt_vupt -c "SELECT string_agg(DISTINCT usename, ',') FROM pg_stat_activity WHERE datname='vapt_vupt' AND usename<>'postgres'")
[ "$users" = vv_runtime ] || fail "conexões da aplicação: $users"
note "aplicação conectada só como vv_runtime; banco keycloak separado (dono: $(psql_super -d postgres -c "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='keycloak'"))"
hdr=$(pcurl -sI "$APP/app" | tr -d '\r' | grep -iE '^(strict-transport-security|content-security-policy):' | cut -c1-60)
note "cabeçalhos: $(echo "$hdr" | tr '\n' ';')"

step "Usuário no Keycloak e empresa provisionada"
kc() { dc exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@" --config /tmp/kcadm.config; }
dc exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master \
 --user bootstrap-admin --password "$kc_admin_pw" --config /tmp/kcadm.config >/dev/null
owner_pw="Drill-$(rnd)"
owner_id=$(kc create users -r vapt -s username=dona.ensaio -s enabled=true -s email=dona@ensaio.example.invalid \
 -s emailVerified=true -s firstName=Dona -s lastName=Ensaio -i | tr -d '\r')
kc set-password -r vapt --userid "$owner_id" --new-password "$owner_pw" >/dev/null
note "usuária dona.ensaio criada no realm vapt (sub $owner_id)"
dc --profile ops run --rm admin provision --name "Mercado do Ensaio" --segment market --unit "Loja" \
 --owner-issuer "$AUTH/realms/vapt" --owner-subject "$owner_id" > "$work/provision.log" 2>&1 || { cat "$work/provision.log"; fail "provision"; }
note "empresa provisionada: $(grep -o '"organizationId":"[^"]*"' "$work/provision.log")"

check() { (cd "$repo" && CHECK_APP_ORIGIN=$APP CHECK_AUTH_ORIGIN=$AUTH CHECK_USER=dona.ensaio CHECK_PASSWORD="$owner_pw" \
 CHECK_SKU=ENSAIO-01 CHECK_SHOT="${2:-}" node deploy/cloud/test/cloud-check.mjs "$1") 2>&1 | tee -a "$report"; }

step "Navegador: HTTPS, login OIDC, cadastro e entrada (seed)"
check seed "$work/cloud-app.png" || fail "verificação no navegador"

step "Consumo de recursos com a pilha ociosa após uso"
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' $(docker ps -q --filter label=com.docker.compose.project=vv-drill) | tee -a "$report"
note "volumes: $(docker system df -v 2>/dev/null | awk '/^vv-drill_/{print $1"="$NF}' | tr '\n' ' ')"

step "Falhas: PostgreSQL reiniciado e processo da API encerrado"
app_id=$(dc ps -q app); started=$(docker inspect -f '{{.State.StartedAt}}' "$app_id")
dc restart postgres >/dev/null; wait_healthy postgres 40
for _ in $(seq 1 30); do dc exec -T app node -e "fetch('http://127.0.0.1:3001/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" && break; sleep 2; done
[ "$(docker inspect -f '{{.State.StartedAt}}' "$app_id")" = "$started" ] || fail "API reiniciou com a queda do banco"
note "PostgreSQL reiniciado: API seguiu no mesmo processo e voltou a responder"
dc exec -T app node -e "process.kill(1, 'SIGTERM')" || true
sleep 5; wait_healthy app 60
rc=$(docker inspect -f '{{.RestartCount}}' "$app_id"); [ "$rc" -ge 1 ] || fail "API encerrada não foi reiniciada"
note "processo da API encerrado: reiniciado pela política de restart (RestartCount=$rc)"
docker restart $(docker ps -q --filter label=com.docker.compose.project=vv-drill) >/dev/null
wait_healthy app 100; wait_healthy keycloak 100
for _ in $(seq 1 30); do pcurl -fsS -m 5 -o /dev/null "$APP/ready" 2>/dev/null && break; sleep 2; done
check verify || fail "dados após reiniciar todos os contêineres"
note "todos os contêineres reiniciados: login e dados preservados"

step "Backup cifrado fora do servidor"
bdir=$("$cloud/ops/backup.sh" 2>&1 | tee "$work/backup.log" | tail -1)
[ -d "$bdir" ] || { cat "$work/backup.log"; fail "backup.sh"; }
grep -E 'prontos|Enviado' "$work/backup.log" | sed 's/^\[[^]]*\] /    /' | tee -a "$report"
for f in "$bdir"/*.age; do head -c 21 "$f" | grep -q 'age-encryption.org/v1' || fail "arquivo não cifrado: $f"; done
grep -l 'ENSAIO-01\|Mercado do Ensaio' "$bdir"/*.age && fail "texto claro dentro do backup"
docker run --rm --network host --env-file "$work/backup.env" "$RCLONE_IMAGE" ls offsite:vv-drill-backups/vapt-vupt | tee -a "$report"
note "arquivos começam com o cabeçalho age e não contêm o texto dos dados"

step "Atualização com sucesso e com reversão (ops/update.sh)"
docker tag "$image" "${image}-next"
VV_UPDATE_BACKUP_ARGS=--local-only "$cloud/ops/update.sh" "${image}-next" > "$work/update-ok.log" 2>&1 || { tail -30 "$work/update-ok.log"; fail "update.sh"; }
grep -q "VV_APP_IMAGE=${image}-next" "$work/drill.env" || fail "update não registrou a nova imagem"
note "atualização para ${image##*/}-next concluída com backup prévio e migrations"
printf 'FROM %s\nCMD ["node","-e","console.error(\\"falha simulada na inicialização\\");process.exit(1)"]\n' "$image" | docker build -q -t "${image}-broken" - >/dev/null
if VV_UPDATE_BACKUP_ARGS=--local-only "$cloud/ops/update.sh" "${image}-broken" > "$work/update-broken.log" 2>&1; then fail "update aceitou imagem quebrada"; fi
grep -q "VV_APP_IMAGE=${image}-next" "$work/drill.env" || fail "imagem quebrada ficou registrada"
load_env; wait_healthy app 40
note "imagem que não inicia: atualização revertida automaticamente para a anterior"
check verify || fail "dados após reversão"

step "Perda total do servidor (down -v) e ensaio de restauração em projeto separado"
backup_id=$(basename "$bdir")
dc down -v --remove-orphans >/dev/null 2>&1
note "projeto vv-drill e volumes removidos (simula servidor perdido)"
mkdir -p "$work/restore-in"
docker run --rm --network host --env-file "$work/backup.env" -v "$work/restore-in:/data" "$RCLONE_IMAGE" copy "offsite:vv-drill-backups/vapt-vupt/$backup_id" /data
s=$(date +%s)
VV_KC_ADMIN_PORT=18081 VV_COMPOSE_EXTRA="" "$cloud/ops/restore.sh" --backup "$work/restore-in" --identity "$work/age-identity.txt" --project vv-drill-restore > "$work/restore-drill.log" 2>&1 || { cat "$work/restore-drill.log"; fail "ensaio de restauração"; }
grep -E '✓|✗|verificada' "$work/restore-drill.log" | sed 's/^\[[^]]*\] //; s/^/    /' | tee -a "$report"
note "ensaio de restauração (banco + migrations + Keycloak + API, sem proxy) em $(( $(date +%s) - s ))s"
if "$cloud/ops/restore.sh" --backup "$work/restore-in" --identity "$work/ca/root.key" --project vv-drill-x > "$work/restore-wrongkey.log" 2>&1; then fail "restaurou com chave errada"; fi
note "chave errada: restauração recusada ($(grep -o 'não foi possível decifrar[^.]*' "$work/restore-wrongkey.log" | head -1))"

step "Recuperação com os segredos do cofre (.env original) e novo login"
s=$(date +%s)
"$cloud/ops/restore.sh" --backup "$work/restore-in" --identity "$work/age-identity.txt" --env "$work/drill.env" --project vv-drill --with-proxy --keep > "$work/restore-full.log" 2>&1 || { cat "$work/restore-full.log"; fail "recuperação"; }
note "recuperação até a API pronta em $(( $(date +%s) - s ))s (sem contar provisionar servidor, DNS e download)"
check verify "$work/cloud-app-restored.png" || fail "login e dados após recuperação"
note "login OIDC com a mesma conta e dados do backup após a recuperação"

step "Exportação dos dados da empresa (portabilidade/encerramento)"
org_id=$(grep -o '"organizationId":"[^"]*"' "$work/provision.log" | cut -d'"' -f4)
dc --profile ops run --rm -T admin export --org "$org_id" > "$work/export.json" 2>"$work/export.err" || { cat "$work/export.err"; fail "export"; }
python3 -I -c 'import json,sys
d=json.load(open(sys.argv[1])); p=d["tables"]["products"]
assert d["organization"]["id"]==sys.argv[2] and any(x["sku"]=="ENSAIO-01" for x in p), "exportação incompleta"
print("    exportação JSON: " + ", ".join(f"{k}={v}" for k,v in d["counts"].items()))' "$work/export.json" "$org_id" | tee -a "$report"

step "Logs sem segredos"
dc logs --no-color > "$work/compose.log" 2>&1
leaks=0
for v in VV_POSTGRES_PASSWORD VV_MIGRATOR_PASSWORD VV_RUNTIME_PASSWORD VV_KEYCLOAK_DB_PASSWORD VV_KEYCLOAK_BOOTSTRAP_PASSWORD VV_OIDC_CLIENT_SECRET; do
 grep -qF -- "${!v}" "$work/compose.log" && { echo "segredo $v aparece nos logs"; leaks=1; }
done
grep -qF -- "$owner_pw" "$work/compose.log" && { echo "senha da usuária aparece nos logs"; leaks=1; }
grep -qE 'auth/callback\?[^ "]*code=' "$work/compose.log" && { echo "código OIDC aparece nos logs"; leaks=1; }
[ "$leaks" = 0 ] || fail "segredos nos logs"
note "$(wc -l < "$work/compose.log") linhas de log dos 4 serviços: nenhuma senha, segredo de cliente ou código OIDC; rotação json-file 10 MB x 5"

if [ "${VV_DRILL_KEEP:-0}" != 1 ]; then
 dc down -v --remove-orphans >/dev/null 2>&1
 docker rm -f vv-drill-offsite >/dev/null; docker volume rm vv-drill-offsite >/dev/null
fi
step "ENSAIO CONCLUÍDO em $(( $(date +%s) - t0 ))s"
echo; cat "$report"
