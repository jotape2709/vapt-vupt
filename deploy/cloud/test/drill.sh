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
# Segredos de configuração com caracteres reservados de URL e "$" garantidos (achado da revisão do lote 3).
secret() { printf '%s/@:%%$' "$("$cloud/ops/gen-secret.sh" 35)"; }
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

kc_admin_pw=$(secret)
cat > "$work/drill.env" <<ENV
VV_PROJECT=vv-drill
VV_APP_IMAGE=$image
VV_APP_ORIGIN=$APP
VV_AUTH_ORIGIN=$AUTH
VV_ACME_EMAIL=drill@example.invalid
VV_POSTGRES_PASSWORD='$(secret)'
VV_MIGRATOR_PASSWORD='$(secret)'
VV_RUNTIME_PASSWORD='$(secret)'
VV_KEYCLOAK_DB_PASSWORD='$(secret)'
VV_KEYCLOAK_BOOTSTRAP_ADMIN=bootstrap-admin
VV_KEYCLOAK_BOOTSTRAP_PASSWORD='$kc_admin_pw'
VV_OIDC_CLIENT_SECRET='$(secret)'
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
sed "s/^VV_PROJECT=.*/VV_PROJECT=vv-drill-neg/; s/^VV_RUNTIME_PASSWORD=.*/VV_RUNTIME_PASSWORD='dev-only-runtime-0000000000000'/" "$work/drill.env" > "$work/neg.env"; chmod 600 "$work/neg.env"
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

step "Backup cifrado fora do servidor, em janela de manutenção (--maintenance)"
s=$(date +%s)
bdir=$("$cloud/ops/backup.sh" --maintenance 2>&1 | tee "$work/backup.log" | tail -1)
[ -d "$bdir" ] || { cat "$work/backup.log"; fail "backup.sh"; }
grep -E 'prontos|Enviado' "$work/backup.log" | sed 's/^\[[^]]*\] /    /' | tee -a "$report"
for f in "$bdir"/*.age; do head -c 21 "$f" | grep -q 'age-encryption.org/v1' || fail "arquivo não cifrado: $f"; done
grep -l 'ENSAIO-01\|Mercado do Ensaio' "$bdir"/*.age && fail "texto claro dentro do backup"
docker run --rm --network host --env-file "$work/backup.env" "$RCLONE_IMAGE" ls offsite:vv-drill-backups/vapt-vupt | tee -a "$report"
note "arquivos começam com o cabeçalho age e não contêm o texto dos dados"
note "janela de manutenção: login e operação parados por $(grep -o 'parados por [0-9]*s' "$work/backup.log" | grep -o '[0-9]*s$'); backup completo com envio em $(( $(date +%s) - s ))s"
for _ in $(seq 1 30); do pcurl -fsS -m 5 -o /dev/null "$APP/ready" 2>/dev/null && break; sleep 2; done

step "Backup ONLINE com operações simultâneas: movimentações pela API, novos usuários e empresas"
stop="$work/load.stop"; rm -f "$stop"
dc exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master \
 --user bootstrap-admin --password "$kc_admin_pw" --config /tmp/kcadm.config >/dev/null
(cd "$repo" && CHECK_APP_ORIGIN=$APP CHECK_AUTH_ORIGIN=$AUTH CHECK_USER=dona.ensaio CHECK_PASSWORD="$owner_pw" \
 CHECK_SKU=CARGA-01 CHECK_STOP_FILE="$stop" node deploy/cloud/test/cloud-check.mjs load) > "$work/load.log" 2>&1 & loadpid=$!
( i=0; while [ ! -f "$stop" ]; do i=$((i+1))
  uid=$(kc create users -r vapt -s username="carga.$i" -s enabled=true -i | tr -d '\r')
  dc --profile ops run --rm -T admin provision --name "Empresa da carga $i" --segment bar --unit Loja \
   --owner-issuer "$AUTH/realms/vapt" --owner-subject "$uid" >/dev/null 2>&1 || exit 1
 done; echo "$i" > "$work/identity.count" ) & idpid=$!
events() { psql_super -d vapt_vupt -c "SELECT count(*) FROM inventory_events"; }
e0=$(events); for _ in $(seq 1 60); do [ "$(events)" -ge $((e0 + 10)) ] && break; sleep 1; done
[ "$(events)" -ge $((e0 + 10)) ] || { cat "$work/load.log"; fail "carga não começou"; }
online=$("$cloud/ops/backup.sh" --local-only 2>&1 | tee "$work/backup-online.log" | tail -1)
[ -d "$online" ] || { cat "$work/backup-online.log"; fail "backup online sob carga"; }
# Reprodução do achado: o método anterior (93d1124) contava as linhas ANTES e fora do snapshot dos dumps.
old="$work/old-method"; mkdir -p "$old/ops"
for f in "$cloud"/*; do [ "$(basename "$f")" = ops ] || ln -sfn "$f" "$old/"; done
cp "$cloud/ops/lib.sh" "$old/ops/"
git -C "$repo" show 93d1124:deploy/cloud/ops/backup.sh > "$old/ops/backup.sh"
legacy=$(bash "$old/ops/backup.sh" --local-only 2>&1 | tee "$work/backup-old.log" | tail -1)
[ -d "$legacy" ] || { cat "$work/backup-old.log"; fail "backup pelo método anterior"; }
sleep 2; touch "$stop"
wait "$loadpid" || { cat "$work/load.log"; fail "carga pela API falhou durante o backup"; }
wait "$idpid" || fail "criação de usuários/empresas falhou durante o backup"
sed 's/^/  /' "$work/load.log" | grep '✓ carga' | tee -a "$report"
note "durante a janela: $(cat "$work/identity.count") usuários criados no Keycloak e $(cat "$work/identity.count") empresas provisionadas"
grep -E 'prontos' "$work/backup-online.log" | sed 's/^\[[^]]*\] /    /' | tee -a "$report"

s=$(date +%s)
VV_KC_ADMIN_PORT=18082 VV_COMPOSE_EXTRA="" "$cloud/ops/restore.sh" --backup "$online" --identity "$work/age-identity.txt" --project vv-drill-online > "$work/restore-online.log" 2>&1 || { cat "$work/restore-online.log"; fail "restauração do backup feito sob carga"; }
grep -E '✓|✗' "$work/restore-online.log" | grep -vE '✓ [a-z_]+: [0-9]+$' | sed 's/^/    /' | tee -a "$report"
note "backup online sob carga restaurado em projeto separado e verificado em $(( $(date +%s) - s ))s: contagens, somas, cadeia de saldos, empresas e identidade iguais ao snapshot"

age -d -i "$work/age-identity.txt" "$legacy/manifest.json.age" > "$work/old-manifest.json"
psql_super -d postgres -c "DROP DATABASE IF EXISTS vv_repro_old" >/dev/null 2>&1
psql_super -d postgres -c "CREATE DATABASE vv_repro_old" >/dev/null
age -d -i "$work/age-identity.txt" "$legacy/vapt_vupt.dump.age" | dc exec -T -u postgres postgres pg_restore -d vv_repro_old --exit-on-error --single-transaction
psql_super -d vv_repro_old -f - < "$cloud/ops/invariants.sql" > "$work/old-restored.json"
psql_super -d postgres -c "DROP DATABASE vv_repro_old" >/dev/null
python3 -I - "$work/old-manifest.json" "$work/old-restored.json" <<'PY' | tee -a "$report"
import json, sys
want = json.load(open(sys.argv[1]))["rowCounts"]; got = json.load(open(sys.argv[2]))
diff = {t: (want.get(t), got["rowCounts"].get(t)) for t in sorted(set(want) | set(got["rowCounts"])) if want.get(t) != got["rowCounts"].get(t)}
print("    método anterior (contagem fora do snapshot): " + (", ".join(f"{t} manifesto {a} × cópia {b}" for t, (a, b) in diff.items()) or "nenhuma divergência nesta execução"))
print(f"    ... e a mesma cópia está íntegra: stockMismatches={got['stockMismatches']}, chainBreaks={got['chainBreaks']}"
      + (" → o restore antigo a teria REPROVADO falsamente" if diff else ""))
PY

step "Atualização e reversão (ops/update.sh): sucesso, falhas da nova versão e falhas externas"
upd() { # nome do log, argumentos; devolve o código de saída
 local rc=0; VV_UPDATE_WAIT=90 VV_UPDATE_BACKUP_ARGS=--local-only "$cloud/ops/update.sh" "${@:2}" > "$work/update-$1.log" 2>&1 || rc=$?
 echo "$rc"
}
current() { grep '^VV_APP_IMAGE=' "$work/drill.env" | cut -d= -f2; }
schema() { psql_super -d vapt_vupt -c "SELECT max(version) FROM schema_migrations"; }
expect() { # cenário, código esperado, código obtido, log
 [ "$3" = "$2" ] || { tail -25 "$work/update-$4.log"; fail "$1: saída $3, esperada $2"; }
  note "$1 → saída $3: $(grep -aE 'Atualizado|NOVA VERSÃO|FORA DA|RECUSADO|SEM REVERSÃO' "$work/update-$4.log" | head -1 | sed 's/^\[[^]]*\] //')"
}
docker tag "$image" "${image}-next"; docker tag "$image" "${image}-next2"
mkimg() { printf 'FROM %s\n%s\n' "$2" "$3" | docker build -q -t "$1" - >/dev/null; }
mkimg "${image}-broken" "$image" 'CMD ["node","-e","console.error(\"falha simulada na inicialização\");process.exit(1)"]'
mkimg "${image}-loopback" "$image" 'ENV API_HOST=127.0.0.1'   # saudável por dentro, inalcançável pelo proxy
mkdir -p "$work/mig"   # contexto de build só com as migrations (nunca o diretório com segredos)
printf '%s\n' '-- compatibilidade-anterior: sim — coluna anulável que a versão anterior ignora (ensaio)' \
 'ALTER TABLE products ADD COLUMN drill_note text;' > "$work/mig/003_drill_note.sql"
# Incompatibilidade SIMULADA: a imagem do ensaio tem o mesmo código; o que se testa é o procedimento
# diante da declaração "não" (recusa sem plano, sem reversão de imagem, API anterior recusando iniciar).
printf '%s\n' '-- compatibilidade-anterior: não — simulação do ensaio de uma mudança incompatível' \
 'CREATE TABLE drill_incompatible_marker(id int PRIMARY KEY);' > "$work/mig/004_drill_incompatible.sql"
printf 'FROM %s\nCOPY 003_drill_note.sql /app/db/migrations/\n' "$image" | docker build -q -t "${image}-compat" -f - "$work/mig" >/dev/null
printf 'FROM %s\nCOPY 004_drill_incompatible.sql /app/db/migrations/\n' "${image}-compat" | docker build -q -t "${image}-breaking" -f - "$work/mig" >/dev/null

expect "atualização normal" 0 "$(upd ok "${image}-next")" ok
[ "$(current)" = "${image}-next" ] || fail "update não registrou a nova imagem"
expect "imagem que não inicia" 1 "$(upd broken "${image}-broken")" broken
[ "$(current)" = "${image}-next" ] || fail "imagem quebrada ficou registrada"
expect "saudável por dentro, mas inacessível pelo endereço público" 1 "$(upd loopback "${image}-loopback")" loopback
[ "$(current)" = "${image}-next" ] || fail "imagem inacessível ficou registrada"
grep -aq 'verificação pública' "$work/update-loopback.log" || fail "falha pública não identificada"

dc stop keycloak >/dev/null
expect "Keycloak fora do ar ANTES da atualização" 3 "$(upd kc-before "${image}-next2")" kc-before
[ "$(current)" = "${image}-next" ] && [ "$(schema)" = 002 ] || fail "algo mudou com a pré-condição falhando"
dc start keycloak >/dev/null; wait_healthy keycloak 60
# Keycloak cai DURANTE a atualização, no momento em que o contêiner da nova versão é criado.
( for _ in $(seq 1 600); do id=$(dc ps -aq app); [ -n "$id" ] && [ "$(docker inspect -f '{{.Config.Image}}' "$id" 2>/dev/null)" = "${image}-next2" ] && { docker stop "$(dc ps -q keycloak)" >/dev/null; exit 0; }; sleep 0.2; done ) & killer=$!
expect "Keycloak cai durante a atualização (externo)" 2 "$(upd kc-during "${image}-next2")" kc-during
wait "$killer" || true
[ "$(current)" = "${image}-next" ] || fail "falha externa registrou a nova imagem"
grep -aq 'Reverter não resolve' "$work/update-kc-during.log" || fail "falha externa não diferenciada"
dc start keycloak >/dev/null; wait_healthy keycloak 60; wait_healthy app 60
wait_public_ok() { for _ in $(seq 1 30); do pcurl -fsS -m 5 -o /dev/null "$APP/ready" 2>/dev/null && return 0; sleep 2; done; return 1; }
wait_public_ok || fail "serviço não voltou depois do Keycloak"

expect "migration declarada compatível (003)" 0 "$(upd compat "${image}-compat")" compat
[ "$(schema)" = 003 ] || fail "migration 003 não aplicada"
VV_APP_IMAGE="${image}-next" dc up -d --wait --wait-timeout 90 app >/dev/null || fail "versão anterior não iniciou sobre o schema 003"
wait_public_ok; check verify > /dev/null || fail "versão anterior sobre o schema 003"
note "versão anterior (${image##*:}-next) sobre o schema 003: iniciou e passou login, saldo e histórico no navegador"
dc up -d --wait --wait-timeout 90 app >/dev/null; wait_public_ok

expect "migration incompatível (004) sem plano de recuperação" 4 "$(upd breaking-refused "${image}-breaking")" breaking-refused
[ "$(schema)" = 003 ] && [ "$(current)" = "${image}-compat" ] || fail "migration incompatível aplicada sem plano"
printf 'Plano do ensaio: restaurar o backup tirado por esta atualização (ops/restore.sh --with-proxy) e voltar para %s.\n' "${image}-compat" > "$work/plano.txt"
expect "migration incompatível (004) com plano explícito" 0 "$(upd breaking "${image}-breaking" --sem-reversao --plano-recuperacao "$work/plano.txt")" breaking
[ "$(schema)" = 004 ] || fail "migration 004 não aplicada"
if VV_APP_IMAGE="${image}-compat" dc up -d --wait --wait-timeout 40 app >/dev/null 2>&1; then fail "versão anterior iniciou sobre schema incompatível"; fi
dc logs --tail 20 app 2>&1 | grep -q 'não foram declaradas compatíveis' || fail "API anterior não explicou a recusa"
note "versão anterior sobre o schema 004: a API recusa iniciar (migration 004 declarada incompatível)"
dc up -d --wait --wait-timeout 90 app >/dev/null; wait_public_ok
check verify || fail "dados após as atualizações"

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
