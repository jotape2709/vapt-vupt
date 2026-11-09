#!/usr/bin/env bash
# Primeira instalação num servidor limpo: preflight, banco, migrations, serviços, verificação.
# Idempotente: rodar de novo não recria dados. Não cria empresas nem usuários (ver OPERACAO.md).
source "$(dirname "$0")/lib.sh"
"$(dirname "$0")/preflight.sh"
load_env
log "Subindo PostgreSQL"
dc up -d postgres
wait_healthy postgres 40
log "Aplicando migrations com o papel de migração"
dc --profile ops run --rm migrate
log "Subindo Keycloak, aplicação e proxy (o Keycloak leva ~1 min na primeira vez)"
dc up -d --wait --wait-timeout 300
dc ps
log "Verificação pública"
for _ in $(seq 1 30); do pcurl -fsS -m 5 -o /dev/null "$VV_APP_ORIGIN/ready" 2>/dev/null && break; sleep 2; done
pcurl -fsS -m 20 "$VV_APP_ORIGIN/ready" && echo
issuer=$(pcurl -fsS -m 20 "$VV_AUTH_ORIGIN/realms/vapt/.well-known/openid-configuration" | sed -n 's/.*"issuer":"\([^"]*\)".*/\1/p')
[ "$issuer" = "$VV_AUTH_ORIGIN/realms/vapt" ] || die "emissor divergente: $issuer"
code=$(pcurl -s -o /dev/null -w '%{http_code}' -m 20 "$VV_AUTH_ORIGIN/admin/")
[ "$code" = 404 ] || die "console administrativo exposto publicamente (HTTP $code)"
log "Instalação concluída: $VV_APP_ORIGIN/app. Próximos passos em docs/cloud/OPERACAO.md (admin do Keycloak, backup, monitor)."
