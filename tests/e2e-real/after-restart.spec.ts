import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/*
 * Rodar DEPOIS de reiniciar PostgreSQL, Keycloak e a API (scripts/e2e-real.sh faz isso):
 * o produto, o saldo e o histórico gravados por real-flow.spec.ts continuam lá.
 */
const stateFile = process.env.E2E_STATE_FILE ?? join(tmpdir(), 'vv-e2e-real-state.json');
test.skip(!process.env.E2E_BASE_URL || !process.env.E2E_AFTER_RESTART || !existsSync(stateFile), 'Verificação pós-reinício NÃO executada (use scripts/e2e-real.sh).');

test('reinício preserva produto, saldo e histórico', async ({ page }) => {
 const state = JSON.parse(readFileSync(stateFile, 'utf8'));
 await page.goto('/app');
 await page.getByRole('button', { name: 'Entrar com a conta da empresa' }).click();
 await page.locator('#username').fill('davi');
 await page.locator('#password').fill('dev-davi-local');
 await page.locator('#kc-login').click();
 await page.waitForURL(/\/app/);
 await expect(page.locator('.topbar')).toContainText('Mercado Aurora');
 await page.getByRole('button', { name: /^Estoque/ }).click();
 await page.getByRole('searchbox', { name: 'Buscar produto' }).fill(state.sku);
 await expect(page.getByRole('row').filter({ hasText: state.sku })).toContainText(`${state.balance} un`);
 await page.getByRole('row').filter({ hasText: state.sku }).getByRole('button', { name: `Ver histórico de ${state.name}` }).click();
 // Entrada de 12, saída de 2 (repetida sem duplicar), entrada de 5 reconciliada, saídas de 1 e 4.
 await expect(page.locator('.movement-list li')).toHaveCount(5);
 await expect(page.getByRole('status').filter({ hasText: 'Mostrando 5 de 5 registros' })).toBeVisible();
 if (process.env.E2E_SCREENSHOTS_DIR) await page.screenshot({ path: join(process.env.E2E_SCREENSHOTS_DIR, '12-after-restart-history.png') });
});
