// Verificação no navegador da instalação em nuvem (ensaio isolado, deploy/cloud/test/drill.sh).
//   node deploy/cloud/test/cloud-check.mjs seed|verify
// Variáveis: CHECK_APP_ORIGIN, CHECK_AUTH_ORIGIN, CHECK_USER, CHECK_PASSWORD, CHECK_SKU, CHECK_SHOT (opcional).
// O navegador aceita o certificado da CA de teste do Caddy (ignoreHTTPSErrors) e só neste ensaio.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const mode = process.argv[2];
const app = process.env.CHECK_APP_ORIGIN, auth = process.env.CHECK_AUTH_ORIGIN;
const user = process.env.CHECK_USER, password = process.env.CHECK_PASSWORD, sku = process.env.CHECK_SKU;
assert.ok(app && auth && user && password && sku && ['seed', 'verify'].includes(mode), 'parâmetros ausentes');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'pt-BR' });
const page = await context.newPage();
const ok = msg => console.log('  ✓ ' + msg);
const api = (method, path, body) => page.evaluate(async ({ method, path, body }) => {
 const session = await (await fetch('/api/session')).json();
 const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken ?? '' }, body: body === undefined ? undefined : JSON.stringify(body) });
 return { status: r.status, body: await r.json().catch(() => null) };
}, { method, path, body });

try {
 const first = await page.goto(app + '/app');
 const headers = first.headers();
 assert.match(headers['strict-transport-security'] ?? '', /max-age=\d+/); ok('HSTS presente');
 await page.getByRole('button', { name: 'Entrar com a conta da empresa' }).click();
 await page.waitForURL(u => u.href.startsWith(auth + '/realms/vapt/'));
 ok('redirecionado ao login em ' + new URL(page.url()).origin);
 await page.locator('#username').fill(user);
 await page.locator('#password').fill(password);
 await page.locator('#kc-login').click();
 await page.waitForURL(u => u.href.startsWith(app + '/app'));
 await page.locator('.topbar').waitFor();
 ok('login concluído e de volta a ' + app);
 const cookies = await context.cookies(app);
 const session = cookies.find(c => c.name === '__Host-vv_session');
 assert.ok(session && session.secure && session.httpOnly && session.sameSite === 'Lax'); ok('cookie __Host-vv_session Secure, HttpOnly, SameSite=Lax');
 const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
 assert.doesNotMatch(stored, /eyJ|vv_session/); ok('nenhum token no armazenamento do navegador');

 const me = (await api('GET', '/api/me')).body;
 assert.equal(me.organizations.length, 1);
 const org = me.organizations[0];
 const unit = (await api('GET', `/api/orgs/${org.id}/context`)).body.unit.id;
 ok(`empresa ${org.displayName} (${org.role})`);
 const stock = async () => (await api('GET', `/api/orgs/${org.id}/units/${unit}/stock?q=${encodeURIComponent(sku)}`)).body.items;

 if (mode === 'seed') {
  const id = crypto.randomUUID();
  const created = await api('POST', `/api/orgs/${org.id}/products`, { id, name: 'Produto do ensaio ' + sku, sku, unit: 'un', minimum: 2, category: 'Ensaio' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const moved = await api('POST', `/api/orgs/${org.id}/units/${unit}/movements`, { eventId: crypto.randomUUID(), productId: id, expectedVersion: 0, kind: 'receipt', quantity: 7, reason: 'Carga do ensaio de restauração' });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  ok('produto ' + sku + ' criado com entrada de 7 un');
 }
 const items = await stock();
 assert.equal(items.length, 1); assert.equal(items[0].quantity, 7);
 const history = (await api('GET', `/api/orgs/${org.id}/units/${unit}/movements`)).body;
 const list = history.items ?? history.movements ?? history;
 assert.ok(JSON.stringify(list).includes('Carga do ensaio de restauração'));
 ok(`saldo ${items[0].quantity} un e histórico presentes (${mode})`);
 await page.reload(); await page.locator('.topbar').waitFor();
 await page.getByRole('button', { name: /^Estoque/ }).click();
 await page.getByRole('row').filter({ hasText: sku }).waitFor();
 await page.waitForTimeout(600);   // fim da animação de entrada antes da captura
 ok('produto visível na tela de estoque');
 if (process.env.CHECK_SHOT) await page.screenshot({ path: process.env.CHECK_SHOT });
 await page.getByRole('button', { name: 'Sair', exact: true }).click();
 await page.waitForURL(u => u.href.startsWith(app + '/app?signed_out=1'));
 assert.equal((await page.request.get(app + '/api/session')).status(), 401); ok('logout encerra a sessão');
} finally {
 await browser.close();
}
