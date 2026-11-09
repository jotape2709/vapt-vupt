#!/usr/bin/env bash
# Backup lógico CIFRADO dos bancos vapt_vupt e keycloak, enviado para fora do servidor.
#   ops/backup.sh               dump + cifra (age) + envio (rclone) + retenção local
#   ops/backup.sh --local-only  sem envio (somente ensaio; NÃO é backup externo)
# Nenhum dump em texto claro toca o disco: pg_dump | age -r <chave pública>. A chave privada fica
# com o fornecedor, fora do servidor. Credencial de destino: deploy/cloud/backup.env (ou VV_BACKUP_ENV_FILE).
source "$(dirname "$0")/lib.sh"
load_env
local_only=0; [ "${1:-}" = --local-only ] && local_only=1
trap 'heartbeat fail "backup falhou em $(hostname) na linha $LINENO"' ERR
command -v age >/dev/null || die "age ausente"
[[ "${VV_BACKUP_AGE_RECIPIENT:-}" == age1* ]] || die "VV_BACKUP_AGE_RECIPIENT inválido"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$VV_BACKUP_DIR/$stamp"
umask 077; mkdir -p "$out"
log "Backup $stamp em $out"

schema=$(psql_super -d vapt_vupt -c "SELECT coalesce(max(version),'') FROM schema_migrations")
tables=$(psql_super -d vapt_vupt -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")
counts=""
for t in $tables; do counts="$counts\"$t\":$(psql_super -d vapt_vupt -c "SELECT count(*) FROM public.\"$t\""),"; done
rls=$(psql_super -d vapt_vupt -c "SELECT coalesce(string_agg(relname, ',' ORDER BY relname),'') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' AND relrowsecurity AND relforcerowsecurity")
kc_users=$(psql_super -d keycloak -c "SELECT count(*) FROM user_entity u JOIN realm r ON r.id=u.realm_id WHERE r.name='vapt'" 2>/dev/null || echo null)

for db in vapt_vupt keycloak; do
 dc exec -T -u postgres postgres pg_dump -Fc -Z 6 -d "$db" | age -r "$VV_BACKUP_AGE_RECIPIENT" > "$out/$db.dump.age"
 [ -s "$out/$db.dump.age" ] || die "dump vazio: $db"
done
pgver=$(psql_super -d vapt_vupt -c "SHOW server_version")
printf '{"format":1,"createdAt":"%s","project":"%s","appImage":"%s","appOrigin":"%s","authOrigin":"%s","postgres":"%s","schemaVersion":"%s","rlsForced":"%s","keycloakUsers":%s,"rowCounts":{%s}}\n' \
 "$stamp" "$VV_PROJECT" "$VV_APP_IMAGE" "$VV_APP_ORIGIN" "$VV_AUTH_ORIGIN" "$pgver" "$schema" "$rls" "$kc_users" "${counts%,}" \
 | age -r "$VV_BACKUP_AGE_RECIPIENT" > "$out/manifest.json.age"
(cd "$out" && sha256sum ./*.age > SHA256SUMS)
size=$(du -sh "$out" | cut -f1)
log "Arquivos cifrados prontos ($size)"

if [ "$local_only" = 0 ]; then
 [ -n "${VV_BACKUP_REMOTE:-}" ] || die "VV_BACKUP_REMOTE vazio"
 [ -f "$VV_BACKUP_ENV_FILE" ] || die "credencial de backup ausente: $VV_BACKUP_ENV_FILE"
 # rclone em contêiner: nada instalado no host; credencial só por variável de ambiente.
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
