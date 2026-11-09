import { defineConfig } from '@playwright/test';

/**
 * Fluxo REAL de ponta a ponta: navegador → Keycloak → API (sessão de servidor) → PostgreSQL.
 * Requer o ambiente local no ar (docs/LOCAL-DEV.md) e não sobe servidores sozinho.
 *   E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_DATABASE_URL=... npm run test:e2e-real
 * Sem E2E_BASE_URL os testes são ignorados (e contam como não executados, nunca como aprovados).
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
export default defineConfig({
 testDir: './tests/e2e-real', fullyParallel: false, workers: 1, retries: 0, timeout: 60_000,
 use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001', trace: 'retain-on-failure', launchOptions: { executablePath }, locale: 'pt-BR' },
 reporter: [['list']],
 projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 } }]
});
