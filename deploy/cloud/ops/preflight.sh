#!/usr/bin/env bash
# Confere o .env da instalação em nuvem antes de instalar ou atualizar. Não altera nada.
# VV_ALLOW_TEST_DOMAINS=1 aceita domínios .test/.invalid (somente ensaio isolado).
source "$(dirname "$0")/lib.sh"
load_env
errors=0; bad() { echo "  ✗ $*"; errors=$((errors+1)); }; ok() { echo "  ✓ $*"; }

echo "Arquivo: $VV_ENV_FILE"
perm=$(stat -c %a "$VV_ENV_FILE"); [ "$perm" = 600 ] && ok "permissão 600" || bad "permissão $perm (use chmod 600)"

for v in VV_APP_IMAGE VV_APP_ORIGIN VV_AUTH_ORIGIN VV_ACME_EMAIL VV_POSTGRES_PASSWORD VV_MIGRATOR_PASSWORD \
         VV_RUNTIME_PASSWORD VV_KEYCLOAK_DB_PASSWORD VV_KEYCLOAK_BOOTSTRAP_PASSWORD VV_OIDC_CLIENT_SECRET \
         VV_BACKUP_AGE_RECIPIENT VV_BACKUP_DIR; do
 val="${!v:-}"
 if [ -z "$val" ]; then bad "$v vazio"; elif [[ "$val" == *REPLACE* ]]; then bad "$v ainda tem valor de modelo"; fi
done

secrets=(VV_POSTGRES_PASSWORD VV_MIGRATOR_PASSWORD VV_RUNTIME_PASSWORD VV_KEYCLOAK_DB_PASSWORD VV_KEYCLOAK_BOOTSTRAP_PASSWORD VV_OIDC_CLIENT_SECRET)
for v in "${secrets[@]}"; do
 val="${!v:-}"; [ "${#val}" -ge 24 ] || bad "$v com menos de 24 caracteres"
 [[ "$val" == dev-only* ]] && bad "$v é credencial de desenvolvimento"
done
dups=$(for v in "${secrets[@]}"; do echo "${!v:-}"; done | sort | uniq -d | grep -c . || true)
[ "$dups" = 0 ] && ok "segredos distintos entre si" || bad "há segredos repetidos"

for v in VV_APP_ORIGIN VV_AUTH_ORIGIN; do
 val="${!v:-}"
 [[ "$val" =~ ^https://[a-z0-9.-]+(:[0-9]+)?$ ]] || bad "$v deve ser https://host sem caminho"
 if [ "${VV_ALLOW_TEST_DOMAINS:-0}" != 1 ] && [[ "$val" =~ \.(test|invalid|example|localhost)(:[0-9]+)?$ ]]; then bad "$v usa domínio reservado"; fi
done
[ "${VV_APP_ORIGIN:-}" != "${VV_AUTH_ORIGIN:-}" ] && ok "origens da aplicação e do login separadas" || bad "app e login precisam de origens diferentes"

case "${VV_APP_IMAGE:-}" in *:latest|*:latest@*) bad "VV_APP_IMAGE não pode usar latest";; *:*) ok "imagem com versão: $VV_APP_IMAGE";; *) bad "VV_APP_IMAGE sem versão";; esac
[[ "${VV_BACKUP_AGE_RECIPIENT:-}" == age1* ]] && ok "destinatário age definido" || bad "VV_BACKUP_AGE_RECIPIENT deve ser uma chave pública age (age1...)"
if [ -z "${VV_BACKUP_REMOTE:-}" ]; then bad "VV_BACKUP_REMOTE vazio: backup ficaria só no servidor"; fi
if [ -f "$VV_BACKUP_ENV_FILE" ]; then bp=$(stat -c %a "$VV_BACKUP_ENV_FILE"); [ "$bp" = 600 ] && ok "credencial de backup com permissão 600" || bad "$VV_BACKUP_ENV_FILE com permissão $bp"
else bad "credencial do armazenamento externo ausente ($VV_BACKUP_ENV_FILE)"; fi

command -v docker >/dev/null && docker compose version >/dev/null 2>&1 && ok "docker compose disponível" || bad "docker compose ausente"
command -v age >/dev/null && ok "age disponível" || bad "age ausente (apt install age)"
dc config -q && ok "compose válido" || bad "compose inválido"

if [ "$errors" -gt 0 ]; then echo "Preflight: $errors problema(s)."; exit 1; fi
echo "Preflight aprovado."
