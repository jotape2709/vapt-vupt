#!/usr/bin/env bash
# Atualização da aplicação para uma nova imagem com versão fixa:
#   ops/update.sh registry.exemplo/vapt-vupt-app:0.3.1
# Ordem: preflight → backup externo (obrigatório) → migrations → troca da aplicação → verificação.
# Se a nova versão não ficar saudável, volta para a imagem anterior. Migrations são aditivas por
# regra do projeto (nunca editadas, só novos arquivos), então a versão anterior continua compatível.
# Uma migration NÃO aditiva exige janela planejada e, em falha, restauração do backup (OPERACAO.md).
source "$(dirname "$0")/lib.sh"
new="${1:?informe a nova imagem (registro/nome:versão)}"
[[ "${new##*/}" == *:* ]] || die "imagem sem versão"
[[ "$new" != *:latest* ]] || die "não use latest"
"$(dirname "$0")/preflight.sh"
load_env
old="$VV_APP_IMAGE"
[ "$old" != "$new" ] || die "a imagem informada já está em uso"
log "Atualização $old -> $new"

log "1/4 Backup antes de mudar qualquer coisa"
"$(dirname "$0")/backup.sh" ${VV_UPDATE_BACKUP_ARGS:-}

log "2/4 Obtendo a imagem"
docker image inspect "$new" >/dev/null 2>&1 || docker pull "$new"

log "3/4 Migrations com a nova versão (transação única: falha = nada aplicado)"
VV_APP_IMAGE="$new" dc --profile ops run --rm migrate

log "4/4 Trocando a aplicação"
if VV_APP_IMAGE="$new" dc up -d --wait --wait-timeout 180 app; then
 sed -i "s#^VV_APP_IMAGE=.*#VV_APP_IMAGE=$new#" "$VV_ENV_FILE"
 echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $old -> $new ok" >> "$VV_CLOUD_DIR/releases.log"
 dc up -d --wait caddy
 pcurl -fsS -m 20 "$VV_APP_ORIGIN/ready" >/dev/null || log "aviso: /ready público não respondeu; confira DNS/proxy"
 log "Atualizado para $new"
else
 log "Nova versão não ficou saudável; voltando para $old"
 dc logs --tail 50 app || true
 VV_APP_IMAGE="$old" dc up -d --wait --wait-timeout 180 app
 echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $old -> $new FALHOU, revertido" >> "$VV_CLOUD_DIR/releases.log"
 die "atualização revertida para $old"
fi
