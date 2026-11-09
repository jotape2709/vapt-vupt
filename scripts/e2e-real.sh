#!/usr/bin/env bash
# Fluxo real completo contra o ambiente local (docs/LOCAL-DEV.md):
#   1. tests/e2e-real/real-flow.spec.ts (login Keycloak, empresas, estoque, conflitos, logout);
#   2. reinicia PostgreSQL, Keycloak e a API;
#   3. tests/e2e-real/after-restart.spec.ts confere que produto, saldo e histórico persistiram.
# Variáveis: E2E_BASE_URL (padrão http://localhost:3001), E2E_ADMIN_DATABASE_URL (para o teste de
# expiração), E2E_RESTART_CMD (padrão: docker compose restart postgres keycloak app),
# E2E_SCREENSHOTS_DIR (opcional, salva capturas).
set -euo pipefail
cd "$(dirname "$0")/.."
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:3001}"
export E2E_STATE_FILE="${E2E_STATE_FILE:-$(mktemp -d)/state.json}"
restart="${E2E_RESTART_CMD:-docker compose restart postgres keycloak app}"

npx playwright test -c playwright.real.config.ts --trace off tests/e2e-real/real-flow.spec.ts
echo "Reiniciando serviços: $restart"
bash -c "$restart"
# A API só escuta depois de descobrir o provedor OIDC, então /ready (banco alcançável) basta.
sleep 3
for i in $(seq 1 90); do curl -sf "$E2E_BASE_URL/ready" >/dev/null && break; sleep 2; done
E2E_AFTER_RESTART=1 npx playwright test -c playwright.real.config.ts --trace off tests/e2e-real/after-restart.spec.ts
