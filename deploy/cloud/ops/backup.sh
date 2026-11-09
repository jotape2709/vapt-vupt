#!/usr/bin/env bash
# Backup lógico CIFRADO dos bancos vapt_vupt e keycloak, enviado para fora do servidor.
#   ops/backup.sh                 online: o serviço continua no ar (padrão do agendamento)
#   ops/backup.sh --maintenance   para Keycloak e aplicação durante a cópia (bancos mutuamente consistentes)
#   ops/backup.sh --local-only    sem envio (somente ensaio; NÃO é backup externo)
#
# Consistência (docs/cloud/OPERACAO.md#backup-e-restauração):
# - Cada banco é copiado de um SNAPSHOT exportado (pg_export_snapshot): o pg_dump e as métricas do
#   manifesto (contagens, somas, invariantes de saldo e de identidade) leem exatamente o mesmo estado,
#   mesmo com movimentações acontecendo durante a cópia.
# - Os dois bancos NÃO formam uma cópia atômica no modo online: o snapshot do vapt_vupt é tirado
#   primeiro e o do keycloak milissegundos depois. Como uma função só é concedida a um usuário que já
#   existe, essa ordem não produz função sem usuário, exceto se um usuário for EXCLUÍDO no intervalo.
#   O manifesto registra esse número ("orphanMemberships"); --maintenance o torna zero por construção.
# Nenhum dump em texto claro toca o disco: pg_dump | age -r <chave pública>.
source "$(dirname "$0")/lib.sh"
load_env
local_only=0 maintenance=0
for arg in "$@"; do case "$arg" in --local-only) local_only=1;; --maintenance) maintenance=1;; *) die "opção desconhecida: $arg";; esac; done
trap 'heartbeat fail "backup falhou em $(hostname) na linha $LINENO"' ERR
command -v age >/dev/null || die "age ausente"
[[ "${VV_BACKUP_AGE_RECIPIENT:-}" == age1* ]] || die "VV_BACKUP_AGE_RECIPIENT inválido"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$VV_BACKUP_DIR/$stamp"
umask 077; mkdir -p "$out"
tmp=$(mktemp -d); sessions=()
cleanup() {
 for fd in "${sessions[@]}"; do eval "exec ${fd}>&-" 2>/dev/null || true; done
 rm -rf "$tmp"
 if [ -n "${stopped:-}" ] && [ -z "${restarted:-}" ]; then dc start keycloak app >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
log "Backup $stamp em $out ($([ "$maintenance" = 1 ] && echo 'janela de manutenção' || echo online))"

# Sessão psql aberta numa transação REPEATABLE READ, com o snapshot exportado em SNAP_<db>.
# Perguntas e respostas por FIFOs: cada consulta devolve uma linha.
open_snapshot() {
 local db="$1" in="$tmp/$1.in" outf="$tmp/$1.out" w r
 mkfifo "$in" "$outf"
 dc exec -T -u postgres postgres psql -X -q -At -v ON_ERROR_STOP=1 -d "$db" < "$in" > "$outf" 2>"$tmp/$db.err" &
 exec {w}>"$in"; exec {r}<"$outf"
 sessions+=("$w" "$r")
 eval "W_$db=$w R_$db=$r"
 echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;" >&"$w"
 echo "SELECT pg_export_snapshot();" >&"$w"
 local snap; read -r -t 30 snap <&"$r" || die "não foi possível abrir snapshot de $db: $(cat "$tmp/$db.err")"
 eval "SNAP_$db=\$snap"
}
ask() { # db, SQL (uma linha de resultado)
 local w r line; eval "w=\$W_$1 r=\$R_$1"
 printf '%s\n' "$2" >&"$w"
 read -r -t 120 line <&"$r" || die "consulta sem resposta em $1: $(cat "$tmp/$1.err")"
 printf '%s' "$line"
}
close_snapshot() { local w; eval "w=\$W_$1"; echo "COMMIT;" >&"$w"; eval "exec ${w}>&-"; }

if [ "$maintenance" = 1 ]; then
 log "Parando Keycloak e aplicação (login e operação indisponíveis durante a cópia)"
 dc stop keycloak app >/dev/null; stopped=$(date +%s)
fi

open_snapshot vapt_vupt     # primeiro: funções só existem para usuários já criados
open_snapshot keycloak
metrics=$(ask vapt_vupt "$(cat "$VV_CLOUD_DIR/ops/invariants.sql")")
issuer="$VV_AUTH_ORIGIN/realms/vapt"
members=$(ask vapt_vupt "SELECT coalesce(string_agg(DISTINCT subject, ' ' ORDER BY subject), '') FROM memberships WHERE issuer = '$(printf '%s' "$issuer" | sed "s/'/''/g")';")
kc_ids=$(ask keycloak "SELECT coalesce(string_agg(u.id, ' ' ORDER BY u.id), '') FROM user_entity u JOIN realm r ON r.id = u.realm_id WHERE r.name = 'vapt';")
kc_users=$(wc -w <<<"$kc_ids" | tr -d ' ')
kc_hash=$(printf '%s' "$kc_ids" | sha256sum | cut -c1-16)
orphans=$(comm -23 <(tr ' ' '\n' <<<"$members" | grep . | sort) <(tr ' ' '\n' <<<"$kc_ids" | grep . | sort) | grep -c . || true)

for db in vapt_vupt keycloak; do
 eval "snap=\$SNAP_$db"
 dc exec -T -u postgres postgres pg_dump --snapshot="$snap" -Fc -Z 6 -d "$db" | age -r "$VV_BACKUP_AGE_RECIPIENT" > "$out/$db.dump.age"
 [ -s "$out/$db.dump.age" ] || die "dump vazio: $db"
done
close_snapshot keycloak; close_snapshot vapt_vupt
if [ "$maintenance" = 1 ]; then
 dc start keycloak app >/dev/null
 wait_healthy keycloak 60; wait_healthy app 60
 restarted=1; log "Keycloak e aplicação de volta (parados por $(( $(date +%s) - stopped ))s)"
fi

pgver=$(psql_super -d vapt_vupt -c "SHOW server_version")
python3 -I - "$metrics" <<PY | age -r "$VV_BACKUP_AGE_RECIPIENT" > "$out/manifest.json.age"
import json, sys
m = json.loads(sys.argv[1])
print(json.dumps({"format": 2, "createdAt": "$stamp", "project": "$VV_PROJECT", "appImage": "$VV_APP_IMAGE",
  "appOrigin": "$VV_APP_ORIGIN", "authOrigin": "$VV_AUTH_ORIGIN", "postgres": "$pgver",
  "mode": "$([ "$maintenance" = 1 ] && echo maintenance || echo online)", "consistency": "snapshot-per-database",
  "vapt": m, "keycloak": {"realmUsers": $kc_users, "userIdsSha256": "$kc_hash"}, "orphanMemberships": $orphans}))
PY
(cd "$out" && sha256sum ./*.age > SHA256SUMS)
size=$(du -sh "$out" | cut -f1)
log "Arquivos cifrados prontos ($size); funções sem usuário no Keycloak: $orphans"

if [ "$local_only" = 0 ]; then
 [ -n "${VV_BACKUP_REMOTE:-}" ] || die "VV_BACKUP_REMOTE vazio"
 [ -f "$VV_BACKUP_ENV_FILE" ] || die "credencial de backup ausente: $VV_BACKUP_ENV_FILE"
 # rclone em contêiner: nada instalado no host; credencial só por variável de ambiente (--env-file
 # do Docker: valores literais, sem aspas). --immutable só impede o rclone de SOBRESCREVER arquivos
 # existentes; não protege contra exclusão — isso é papel do bloqueio de objetos/retenção do provedor.
 docker run --rm --network host --env-file "$VV_BACKUP_ENV_FILE" -v "$out:/data:ro" \
  "${VV_RCLONE_IMAGE:-rclone/rclone:1.71}" copy /data "$VV_BACKUP_REMOTE/$stamp" --immutable --s3-no-check-bucket
 docker run --rm --network host --env-file "$VV_BACKUP_ENV_FILE" -v "$out:/data:ro" \
  "${VV_RCLONE_IMAGE:-rclone/rclone:1.71}" check /data "$VV_BACKUP_REMOTE/$stamp" --one-way
 log "Enviado e conferido em $VV_BACKUP_REMOTE/$stamp"
fi

# Retenção local curta (a retenção longa é a do armazenamento externo, com bloqueio de exclusão).
find "$VV_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*Z' -mtime +"${VV_BACKUP_LOCAL_KEEP_DAYS:-7}" -exec rm -rf {} +
usage=$(df -P "$VV_BACKUP_DIR" | awk 'NR==2{gsub("%","",$5);print $5}')
[ "$usage" -lt 85 ] || { heartbeat fail "disco em ${usage}%"; die "disco em ${usage}%"; }
heartbeat ok "backup $stamp $size disco ${usage}%"
echo "$out"
