import { test, expect, type Browser, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';

/*
 * Fluxo real com Keycloak, API e PostgreSQL do ambiente local (docs/LOCAL-DEV.md), semeado por
 * `npm run seed:local`: Mercado Aurora (ana proprietária, bruno operador, davi consulta) e
 * Adega Vértice (carla proprietária, ana consulta); eva sem acesso. Nada aqui é simulado no
 * servidor: o único artifício é page.route para perder uma resposta ou atrasá-la.
 */
const enabled = !!process.env.E2E_BASE_URL;
test.skip(!enabled, 'E2E_BASE_URL ausente: fluxo real NÃO executado.');
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36).toUpperCase();
const product = { name: `Café especial ${run}`, sku: `E2E-${run}` };
const stateFile = process.env.E2E_STATE_FILE ?? join(tmpdir(), 'vv-e2e-real-state.json');
const shots = process.env.E2E_SCREENSHOTS_DIR;
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: join(shots, name + '.png') }); };

async function signIn(browser: Browser, user: string) {
 const context = await browser.newContext();
 const page = await context.newPage();
 await page.goto('/app');
 await page.getByRole('button', { name: 'Entrar com a conta da empresa' }).click();
 await page.waitForURL(/localhost:8080\/realms\/vapt/);
 await page.locator('#username').fill(user);
 await page.locator('#password').fill(`dev-${user}-local`);
 await page.locator('#kc-login').click();
 await page.waitForURL(/\/app/);
 return { context, page };
}

/** Chamada à API a partir da página autenticada (cookie HttpOnly + token CSRF da sessão). */
async function api(page: Page, method: string, path: string, body?: unknown) {
 return page.evaluate(async ({ method, path, body }) => {
  const session = await (await fetch('/api/session')).json();
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken ?? '' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
 }, { method, path, body });
}

const ids: { aurora?: string; vertice?: string; auroraUnit?: string; verticeUnit?: string; productId?: string } = {};
let ana: Page, bruno: Page;

test('1. login pelo Keycloak e apenas empresas autorizadas', async ({ browser }) => {
 ana = (await signIn(browser, 'ana')).page;
 await expect(ana.locator('.demo-pill')).toHaveText('OPERAÇÃO REAL');
 const options = await ana.getByLabel('Selecionar empresa').locator('option').allTextContents();
 expect(options).toEqual(['Adega Vértice · Consulta', 'Mercado Aurora · Proprietário']);
 // A primeira empresa abre por ordem alfabética (ou a última usada); Ana escolhe o Mercado.
 await ana.getByLabel('Selecionar empresa').selectOption({ label: 'Mercado Aurora · Proprietário' });
 await expect(ana.locator('.topbar')).toContainText('Mercado Aurora');
 const me = (await api(ana, 'GET', '/api/me')).body;
 ids.aurora = me.organizations.find((o: { displayName: string }) => o.displayName.startsWith('Mercado'))?.id;
 ids.vertice = me.organizations.find((o: { displayName: string }) => o.displayName.startsWith('Adega'))?.id;
 ids.auroraUnit = (await api(ana, 'GET', `/api/orgs/${ids.aurora}/context`)).body.unit.id;
 // Nenhum token de autenticação no armazenamento do navegador.
 const stored = await ana.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
 expect(stored).not.toMatch(/eyJ|vv_session|token/i);
 await shot(ana, '01-ana-overview');
});

test('2. proprietária configura a identidade e a configuração persiste no servidor', async () => {
 await ana.getByRole('button', { name: 'Personalização', exact: true }).click();
 // Logotipo fictício desenhado no próprio navegador (sol nascente "MA"), enviado como PNG real.
 const logo = Buffer.from(await ana.evaluate(async () => {
  const c = new OffscreenCanvas(128, 128); const g = c.getContext('2d')!;
  g.fillStyle = '#0b3aa8'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffb547'; g.beginPath(); g.arc(64, 84, 40, Math.PI, 0); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('MA', 64, 120);
  return [...new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())];
 }));
 await ana.getByLabel(/^Logotipo/).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo });
 await expect(ana.getByRole('img', { name: 'Logotipo em prévia' })).toBeVisible();
 await ana.getByLabel('Página inicial').selectOption('inventory');
 await ana.getByRole('button', { name: 'Salvar personalização' }).click();
 await expect(ana.getByRole('status').filter({ hasText: /Personalização salva no servidor \(versão \d+\)/ })).toBeVisible();
 await shot(ana, '02-ana-settings');
 await ana.reload();
 await expect(ana.locator('.business-box img')).toBeVisible();
 await expect(ana.getByRole('heading', { level: 1, name: 'Estoque' })).toBeVisible();
});

test('3. cadastro pela busca e primeira entrada confirmada pelo servidor', async () => {
 await ana.getByRole('searchbox', { name: 'Buscar produto' }).fill(product.name);
 await ana.getByRole('button', { name: `Cadastrar “${product.name}”` }).click();
 const dialog = ana.getByRole('dialog', { name: 'Novo produto' });
 await dialog.getByLabel('Código interno').fill(product.sku);
 await dialog.getByLabel('Categoria').fill('Mercearia');
 await dialog.getByLabel('Estoque mínimo').fill('10');
 await dialog.getByRole('button', { name: 'Salvar produto' }).click();
 const created = ana.getByRole('status').filter({ hasText: `${product.name} cadastrado com saldo 0 un. Cadastro confirmado pelo servidor.` });
 await expect(created).toBeVisible();
 await created.getByRole('button', { name: 'Registrar entrada' }).click();
 const move = ana.getByRole('dialog', { name: 'Registrar movimentação' });
 await move.getByLabel(/^Quantidade/).fill('12');
 await move.getByRole('button', { name: 'Recebimento de fornecedor' }).click();
 await shot(ana, '03-ana-movement-form');
 await move.getByRole('button', { name: 'Registrar entrada', exact: true }).click();
 const confirmed = ana.getByRole('status').filter({ hasText: 'Entrada confirmada pelo servidor' });
 await expect(confirmed).toContainText(`+12 un de ${product.name}. Saldo 0 → 12 un.`);
 await expect(confirmed).toContainText('por Ana Proprietária');
 await expect(ana.getByRole('row').filter({ hasText: product.sku })).toContainText('12 un');
 await shot(ana, '04-ana-confirmed');
 ids.productId = (await api(ana, 'GET', `/api/orgs/${ids.aurora}/units/${ids.auroraUnit}/stock?q=${product.sku}`)).body.items[0].id;
});

test('4. segunda sessão autorizada vê produto e movimentação; só a própria empresa', async ({ browser }) => {
 bruno = (await signIn(browser, 'bruno')).page;
 await expect(bruno.locator('.topbar')).toContainText('Mercado Aurora');
 expect(await bruno.getByLabel('Selecionar empresa').locator('option').allTextContents()).toEqual(['Mercado Aurora · Operador']);
 await bruno.getByRole('button', { name: /^Movimentações/ }).click();
 await expect(bruno.locator('.movement-list li').filter({ hasText: product.name }).first()).toContainText('Ana Proprietária');
 await bruno.getByRole('button', { name: /^Estoque/ }).click();
 await bruno.getByRole('searchbox', { name: 'Buscar produto' }).fill(product.sku);
 await expect(bruno.getByRole('row').filter({ hasText: product.sku })).toContainText('12 un');
 // Operador movimenta, mas não cadastra nem altera a empresa (o servidor também recusa).
 await bruno.getByRole('button', { name: /^Produtos/ }).click();
 await expect(bruno.getByRole('button', { name: 'Novo produto' })).toHaveCount(0);
 expect((await api(bruno, 'POST', `/api/orgs/${ids.aurora}/products`, { id: crypto.randomUUID(), name: 'Tentativa', sku: 'X-' + run, unit: 'un', minimum: 0, category: 'X' })).status).toBe(403);
 await shot(bruno, '05-bruno-history');
});

test('5. reenviar a mesma operação não duplica o estoque', async () => {
 const stock = async () => (await api(bruno, 'GET', `/api/orgs/${ids.aurora}/units/${ids.auroraUnit}/stock?q=${product.sku}`)).body.items[0];
 const before = await stock();
 const body = { eventId: crypto.randomUUID(), productId: ids.productId, expectedVersion: before.stockVersion, kind: 'issue', quantity: 2, reason: 'Venda no balcão' };
 const first = await api(bruno, 'POST', `/api/orgs/${ids.aurora}/units/${ids.auroraUnit}/movements`, body);
 const again = await api(bruno, 'POST', `/api/orgs/${ids.aurora}/units/${ids.auroraUnit}/movements`, body);
 expect([first.status, first.body.replayed, again.status, again.body.replayed]).toEqual([200, false, 200, true]);
 expect(again.body.movement.eventId).toBe(body.eventId);
 expect((await stock()).quantity).toBe(before.quantity - 2);
 const divergent = await api(bruno, 'POST', `/api/orgs/${ids.aurora}/units/${ids.auroraUnit}/movements`, { ...body, quantity: 3 });
 expect(divergent.status).toBe(409);
});

test('6. servidor rejeita outra organização, mesmo com IDs trocados à mão', async () => {
 expect((await api(bruno, 'GET', `/api/orgs/${ids.vertice}/context`)).status).toBe(403);
 expect((await api(bruno, 'GET', `/api/orgs/${ids.vertice}/units/${ids.auroraUnit}/stock`)).status).toBe(403);
 expect((await api(bruno, 'POST', `/api/orgs/${ids.vertice}/products`, { id: crypto.randomUUID(), name: 'Intruso', sku: 'I-' + run, unit: 'un', minimum: 0, category: 'X' })).status).toBe(403);
 // Sem token CSRF a escrita é recusada mesmo com a sessão válida.
 const noCsrf = await bruno.evaluate(async path => (await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, `/api/orgs/${ids.aurora}/units/${ids.auroraUnit}/movements`);
 expect(noCsrf).toBe(403);
});

test('7. resposta perdida: resultado desconhecido e reconciliação pelo identificador', async () => {
 await bruno.getByRole('button', { name: /^Estoque/ }).click();
 await bruno.getByRole('searchbox', { name: 'Buscar produto' }).fill(product.sku);
 const row = bruno.getByRole('row').filter({ hasText: product.sku });
 await expect(row).toContainText('10 un');
 // O servidor recebe e grava; a resposta é descartada antes de chegar ao navegador.
 await bruno.route('**/units/*/movements', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  await route.fetch();
  await route.abort('connectionreset');
 }, { times: 1 });
 await row.getByRole('button', { name: `Registrar entrada de ${product.name}` }).click();
 const move = bruno.getByRole('dialog', { name: 'Registrar movimentação' });
 await move.getByLabel(/^Quantidade/).fill('5');
 await move.getByLabel('Motivo', { exact: true }).fill('Recebimento parcial');
 await move.getByRole('button', { name: 'Registrar entrada', exact: true }).click();
 await expect(move.getByText('Não sabemos se a operação foi registrada.')).toBeVisible();
 await expect(move.getByLabel(/^Quantidade/)).toHaveAttribute('readonly', '');
 await shot(bruno, '06-bruno-unknown-outcome');
 await move.getByRole('button', { name: 'Verificar registro' }).click();
 await expect(bruno.getByRole('status').filter({ hasText: 'já estava registrada no servidor' })).toContainText('Saldo 10 → 15 un.');
 await expect(row).toContainText('15 un');
});

test('8. duas sessões no mesmo produto: conflito orienta revisar o saldo', async () => {
 await ana.getByRole('button', { name: /^Estoque/ }).click();
 await ana.getByRole('searchbox', { name: 'Buscar produto' }).fill(product.sku);
 // A tela de Ana não se atualiza sozinha: ela ainda vê o saldo de antes da entrada de Bruno.
 const anaRow = ana.getByRole('row').filter({ hasText: product.sku });
 await expect(anaRow).toContainText('12 un');
 await anaRow.getByRole('button', { name: `Registrar saída de ${product.name}` }).click();
 const anaMove = ana.getByRole('dialog', { name: 'Registrar movimentação' });
 await anaMove.getByLabel(/^Quantidade/).fill('4');
 await anaMove.getByRole('button', { name: 'Venda no balcão' }).click();
 // Enquanto o formulário de Ana está aberto, Bruno registra no mesmo produto.
 const brunoRow = bruno.getByRole('row').filter({ hasText: product.sku });
 await brunoRow.getByRole('button', { name: `Registrar saída de ${product.name}` }).click();
 const brunoMove = bruno.getByRole('dialog', { name: 'Registrar movimentação' });
 await brunoMove.getByLabel(/^Quantidade/).fill('1');
 await brunoMove.getByRole('button', { name: 'Consumo interno' }).click();
 await brunoMove.getByRole('button', { name: 'Registrar saída', exact: true }).click();
 await expect(bruno.getByRole('status').filter({ hasText: 'Saída confirmada pelo servidor' })).toBeVisible();
 await anaMove.getByRole('button', { name: 'Registrar saída', exact: true }).click();
 await expect(anaMove.getByRole('alert').filter({ hasText: 'O saldo deste produto mudou' })).toContainText('Saldo atual: 14 un');
 await expect(anaMove.locator('.balance-preview')).toContainText('Saldo atual14 un');
 await shot(ana, '07-ana-conflict');
 await anaMove.getByRole('button', { name: 'Registrar saída', exact: true }).click();
 await expect(ana.getByRole('status').filter({ hasText: 'Saída confirmada pelo servidor' })).toContainText('Saldo 14 → 10 un.');
});

test('9. troca de empresa descarta respostas atrasadas da empresa anterior', async () => {
 await ana.route(`**/api/orgs/${ids.aurora}/units/*/stock*`, async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue().catch(() => undefined); });
 await ana.getByRole('button', { name: /^Produtos/ }).click();
 await ana.getByLabel('Selecionar empresa').selectOption(ids.vertice!);
 await expect(ana.locator('.topbar')).toContainText('Adega Vértice');
 await ana.waitForTimeout(3500);
 await expect(ana.locator('.topbar')).toContainText('Adega Vértice');
 await expect(ana.getByText(product.sku)).toHaveCount(0);
 await expect(ana.locator('.workspace')).toHaveAttribute('data-accent', 'navy');
 // Ana é só Consulta na Adega: sem ações de escrita.
 await expect(ana.getByRole('button', { name: 'Registrar movimentação' })).toHaveCount(0);
 await shot(ana, '08-ana-vertice-viewer');
 await ana.unrouteAll({ behavior: 'ignoreErrors' });
});

test('10. outra empresa com identidade própria; conta sem empresa não acessa nada', async ({ browser }) => {
 const carla = (await signIn(browser, 'carla')).page;
 await expect(carla.locator('.topbar')).toContainText('Adega Vértice');
 expect(await carla.getByLabel('Selecionar empresa').locator('option').allTextContents()).toEqual(['Adega Vértice · Proprietário']);
 await expect(carla.locator('.workspace')).toHaveClass(/dark/);
 await expect(carla.getByText(product.sku)).toHaveCount(0);
 expect((await api(carla, 'GET', `/api/orgs/${ids.aurora}/movements/${crypto.randomUUID()}`)).status).toBe(403);
 await shot(carla, '09-carla-vertice');
 const eva = (await signIn(browser, 'eva')).page;
 await expect(eva.getByRole('heading', { name: 'Sua conta ainda não tem acesso a uma empresa' })).toBeVisible();
 await expect(eva.locator('.identity-box')).toContainText('a0000000-0000-4000-8000-0000000000e5');
 await shot(eva, '10-eva-no-access');
});

test('11. sessão expirada descarta os dados; logout encerra no servidor e no provedor', async () => {
 const adminUrl = process.env.E2E_ADMIN_DATABASE_URL;
 if (adminUrl) {
  const pool = new Pool({ connectionString: adminUrl, max: 1 });
  try { await pool.query("UPDATE sessions SET idle_expires_at=now() - interval '1 second' WHERE subject=$1 AND revoked_at IS NULL", ['a0000000-0000-4000-8000-0000000000b2']); }
  finally { await pool.end(); }
  await bruno.getByRole('button', { name: /^Movimentações/ }).click();
  await expect(bruno.getByRole('heading', { name: 'Sua sessão terminou' })).toBeVisible();
  await shot(bruno, '11-bruno-expired');
 } else test.info().annotations.push({ type: 'não executado', description: 'expiração: E2E_ADMIN_DATABASE_URL ausente' });

 await ana.getByRole('button', { name: 'Sair' }).click();
 await ana.waitForURL(/\/app\?signed_out=1/);
 await expect(ana.getByText('Você saiu.')).toBeVisible();
 expect((await ana.evaluate(async () => (await fetch('/api/session')).status))).toBe(401);
 // A sessão do provedor também terminou: entrar de novo pede a senha.
 await ana.getByRole('button', { name: 'Entrar com a conta da empresa' }).click();
 await expect(ana.locator('#password')).toBeVisible();

 const balance = 10;
 writeFileSync(stateFile, JSON.stringify({ sku: product.sku, name: product.name, balance, aurora: ids.aurora, unit: ids.auroraUnit }));
});
