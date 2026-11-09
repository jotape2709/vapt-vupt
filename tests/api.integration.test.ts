import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { buildApp } from '../apps/api/app';
import { exportOrganization, provision, grant, revokeSessions } from '../apps/api/admin';
import { Database } from '../apps/api/db';
import { Operations } from '../apps/api/operations';
import { SessionStore } from '../apps/api/sessions';
import { settingsFromTemplate } from '../packages/domain/contracts';
import { APP_ORIGIN, clientFor, login, pngImage, type TestClient } from './support/client';
import { oidcFixture } from './support/oidc-fixture';
import { testDatabase } from './support/pg';

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;

/**
 * Integração com PostgreSQL real, papel de runtime restrito (vv_app) e as rotas HTTP reais.
 * A única peça simulada é o provedor OIDC (fixture explícita); o fluxo com Keycloak real é
 * coberto em tests/e2e-real. Cada execução usa um emissor próprio para poder repetir no mesmo banco.
 */
test('operação real: autenticação, isolamento, permissões, estoque, histórico e configuração', { skip: !adminUrl, timeout: 180_000 }, async t => {
 const { admin, runtime } = await testDatabase(adminUrl!);
 const issuer = 'https://idp.test.invalid/' + randomUUID();
 const people = {
  alice: { subject: 'alice-' + randomUUID(), name: 'Alice Proprietária', email: 'alice@example.invalid' },
  mary: { subject: 'mary-' + randomUUID(), name: 'Mary Gestora', email: null },
  olga: { subject: 'olga-' + randomUUID(), name: 'Olga Operadora', email: null },
  vera: { subject: 'vera-' + randomUUID(), name: 'Vera Consulta', email: null },
  bob: { subject: 'bob-' + randomUUID(), name: 'Bob da Adega', email: null },
  nobody: { subject: 'nobody-' + randomUUID(), name: 'Sem Acesso', email: null }
 };
 let pool: Pool = runtime();
 const policy = { idleMinutes: 30, absoluteHours: 12 };
 const make = (p: Pool) => buildApp(
  { ops: new Operations(new Database(p)), sessions: new SessionStore(new Database(p), policy), oidc: oidcFixture(issuer, people) },
  { appOrigin: APP_ORIGIN, secureCookies: false, logger: false, rateLimitMax: 100_000 });
 let app = make(pool);

 try {
  const A = await provision(admin, { name: 'Mercado Aurora', segment: 'market', unit: 'Loja Centro', 'owner-issuer': issuer, 'owner-subject': people.alice.subject });
  const B = await provision(admin, { name: 'Adega Vértice', segment: 'wine_shop', 'owner-issuer': issuer, 'owner-subject': people.bob.subject });
  for (const [who, role] of [['mary', 'manager'], ['olga', 'operator'], ['vera', 'viewer']] as const) await grant(admin, { org: A.organizationId, issuer, subject: people[who].subject, role });
  const a = (path: string) => `/api/orgs/${A.organizationId}${path}`;
  const b = (path: string) => `/api/orgs/${B.organizationId}${path}`;
  const stockA = a(`/units/${A.unitId}/stock`), movesA = a(`/units/${A.unitId}/movements`);

  const c: Record<string, TestClient> = {};

  await t.test('login pelo fluxo de autenticação, cookie HttpOnly e retorno seguro', async () => {
   assert.equal((await app.inject({ url: '/api/session' })).statusCode, 401);
   const noTx = await app.inject({ url: '/auth/callback?code=alice&state=x' });
   assert.equal(noTx.headers.location, '/app?auth_error=expired');
   const start = await app.inject({ url: '/auth/login?returnTo=//evil.example/x' });
   const loginCookie = start.cookies.find(x => x.name === 'vv_login')!;
   assert.equal(loginCookie.httpOnly, true);
   const wrongState = await app.inject({ url: '/auth/callback?code=alice&state=forjado', cookies: { vv_login: loginCookie.value } });
   assert.equal(wrongState.headers.location, '/app?auth_error=failed');
   // A transação é de uso único: o mesmo cookie não serve para uma segunda tentativa.
   const state = new URL(String(start.headers.location)).searchParams.get('state')!;
   const replay = await app.inject({ url: `/auth/callback?code=alice&state=${state}`, cookies: { vv_login: loginCookie.value } });
   assert.equal(replay.headers.location, '/app?auth_error=expired');
   for (const who of Object.keys(people)) c[who] = await login(app, who);
   const fresh = await app.inject({ url: '/auth/login?returnTo=//evil.example/x' });
   const st = new URL(String(fresh.headers.location)).searchParams.get('state')!;
   const ok = await app.inject({ url: `/auth/callback?code=alice&state=${st}`, cookies: { vv_login: fresh.cookies.find(x => x.name === 'vv_login')!.value } });
   assert.equal(ok.headers.location, '/app', 'returnTo externo vira /app');
   const session = ok.cookies.find(x => x.name === 'vv_session')!;
   assert.equal(session.httpOnly, true);
   assert.equal(session.sameSite, 'Lax');
   const info = (await c.alice.get('/api/session')).json();
   assert.equal(info.user.subject, people.alice.subject);
   assert.ok(info.csrfToken.length >= 32);
  });

  await t.test('cada usuário vê apenas as empresas autorizadas', async () => {
   const alice = (await c.alice.get('/api/me')).json();
   assert.deepEqual(alice.organizations.map((o: { id: string; role: string }) => [o.id, o.role]), [[A.organizationId, 'owner']]);
   const bob = (await c.bob.get('/api/me')).json();
   assert.deepEqual(bob.organizations.map((o: { displayName: string }) => o.displayName), ['Adega Vértice']);
   assert.deepEqual((await c.nobody.get('/api/me')).json().organizations, []);
   const ctx = (await c.vera.get(a('/context'))).json();
   assert.equal(ctx.role, 'viewer');
   assert.equal(ctx.unit.name, 'Loja Centro');
   assert.equal(ctx.unitPolicy, 'single-unit-pilot');
   assert.equal(ctx.settings.settings.identity.segment, 'market');
  });

  await t.test('servidor rejeita outra organização, inclusive com IDs trocados manualmente', async () => {
   assert.equal((await c.alice.get(b('/context'))).statusCode, 403);
   assert.equal((await c.nobody.get(a('/context'))).statusCode, 403);
   assert.equal((await c.alice.get(b(`/units/${B.unitId}/stock`))).statusCode, 403);
   assert.equal((await c.alice.send('POST', b('/products'), { id: randomUUID(), name: 'Intruso', sku: 'X-1', unit: 'un', minimum: 0, category: 'X' })).statusCode, 403);
   // Unidade de B no caminho de A: membership de A confere, mas a unidade não pertence a A.
   assert.equal((await c.alice.get(a(`/units/${B.unitId}/stock`))).statusCode, 404);
   assert.equal((await c.alice.get('/api/orgs/not-a-uuid/context')).statusCode, 400);
   assert.equal((await c.alice.get(`/api/orgs/${randomUUID()}/context`)).statusCode, 403);
  });

  await t.test('CSRF: operações autenticadas exigem token e origem da aplicação', async () => {
   const body = { id: randomUUID(), name: 'Teste CSRF', sku: 'CSRF-1', unit: 'un', minimum: 0, category: 'Teste' };
   const noToken = await app.inject({ method: 'POST', url: a('/products'), cookies: { vv_session: c.alice.cookie }, headers: { origin: APP_ORIGIN }, payload: body });
   assert.equal(noToken.statusCode, 403); assert.equal(noToken.json().error, 'csrf_rejected');
   const badOrigin = await c.alice.send('POST', a('/products'), body, { origin: 'https://evil.example' });
   assert.equal(badOrigin.statusCode, 403);
   const crossSite = await app.inject({ method: 'POST', url: a('/products'), cookies: { vv_session: c.alice.cookie }, headers: { 'x-csrf-token': c.alice.csrf, 'sec-fetch-site': 'cross-site' }, payload: body });
   assert.equal(crossSite.statusCode, 403);
   const otherToken = await c.alice.send('POST', a('/products'), body, { 'x-csrf-token': c.mary.csrf });
   assert.equal(otherToken.statusCode, 403, 'token de outra sessão não vale');
   assert.equal((await c.alice.send('POST', a('/products'), body)).statusCode, 201);
  });

  let rice = '';
  await t.test('matriz de permissões: cadastro, movimentação e configuração por função', async () => {
   const product = (sku: string) => ({ id: randomUUID(), name: 'Produto ' + sku, sku, unit: 'un', minimum: 5, category: 'Mercearia' });
   assert.equal((await c.vera.send('POST', a('/products'), product('V-1'))).statusCode, 403);
   assert.equal((await c.olga.send('POST', a('/products'), product('O-1'))).statusCode, 403);
   const created = await c.mary.send('POST', a('/products'), { ...product('AUR-001'), name: 'Arroz branco · 5 kg' });
   assert.equal(created.statusCode, 201);
   rice = created.json().id;
   assert.equal(created.json().quantity, 0);
   const move = (client: TestClient, version: number, quantity = 1) => client.send('POST', movesA, { eventId: randomUUID(), productId: rice, expectedVersion: version, kind: 'receipt', quantity, reason: 'Recebimento' });
   assert.equal((await move(c.vera, 0)).statusCode, 403);
   assert.equal((await move(c.olga, 0, 10)).statusCode, 200);
   assert.equal((await c.vera.get(stockA)).statusCode, 200);
   assert.equal((await c.vera.get(movesA)).statusCode, 200);
   const ctx = (await c.mary.get(a('/context'))).json();
   const appearance = { ...ctx.settings.settings, appearance: { ...ctx.settings.settings.appearance, density: 'compact' } };
   assert.equal((await c.olga.send('PUT', a('/settings'), { expectedVersion: ctx.settings.version, settings: appearance })).statusCode, 403);
   const managerSave = await c.mary.send('PUT', a('/settings'), { expectedVersion: ctx.settings.version, settings: appearance });
   assert.equal(managerSave.statusCode, 200);
   const renamed = { ...managerSave.json().settings, identity: { ...managerSave.json().settings.identity, displayName: 'Nome do Gestor' } };
   assert.equal((await c.mary.send('PUT', a('/settings'), { expectedVersion: managerSave.json().version, settings: renamed })).statusCode, 403, 'identidade é do proprietário');
   assert.equal((await c.mary.send('POST', a('/logo'), pngImage(32, 32), { 'content-type': 'image/png' })).statusCode, 403);
   // Saldo nunca é editado pelo cadastro.
   assert.equal((await c.alice.send('POST', a('/products'), { ...product('Q-1'), quantity: 50 })).statusCode, 400);
  });

  await t.test('cadastro: código duplicado e repetição do mesmo cadastro', async () => {
   const p = { id: randomUUID(), name: 'Café torrado · 500 g', sku: 'aur-002', unit: 'un', minimum: 12, category: 'Mercearia' };
   assert.equal((await c.alice.send('POST', a('/products'), p)).statusCode, 201);
   assert.equal((await c.alice.send('POST', a('/products'), p)).statusCode, 201, 'mesmo id e conteúdo: devolve o existente');
   const dup = await c.alice.send('POST', a('/products'), { ...p, id: randomUUID(), sku: 'AUR-002' });
   assert.equal(dup.statusCode, 409); assert.equal(dup.json().error, 'duplicate_sku');
   assert.equal((await c.alice.send('POST', a('/products'), { ...p, name: 'Outro nome' })).statusCode, 409);
   // O mesmo código em outra organização é permitido: catálogo por organização.
   assert.equal((await c.bob.send('POST', b('/products'), { ...p, id: randomUUID() })).statusCode, 201);
  });

  await t.test('movimentação: repetição, conteúdo divergente, resposta perdida, conflito e saldo negativo', async () => {
   const row = async () => (await c.alice.get(stockA + '?q=AUR-001')).json().items[0];
   const before = await row();
   assert.equal(before.quantity, 10);
   const m = { eventId: randomUUID(), productId: rice, expectedVersion: before.stockVersion, kind: 'issue', quantity: 3, reason: 'Venda no balcão' };
   const first = await c.alice.send('POST', movesA, m);
   assert.equal(first.statusCode, 200);
   assert.equal(first.json().replayed, false);
   assert.deepEqual([first.json().movement.balanceBefore, first.json().movement.balanceAfter], [10, 7]);
   assert.equal(first.json().movement.actorName, 'Alice Proprietária');
   const replay = await c.alice.send('POST', movesA, m);
   assert.equal(replay.json().replayed, true);
   assert.equal(replay.json().movement.eventId, m.eventId);
   assert.equal((await row()).quantity, 7, 'repetição não movimenta de novo');
   const divergent = await c.alice.send('POST', movesA, { ...m, quantity: 4 });
   assert.equal(divergent.statusCode, 409); assert.equal(divergent.json().error, 'event_payload_conflict');
   // Resposta perdida: o cliente não sabe o resultado e reconcilia pelo identificador.
   const lost = { ...m, eventId: randomUUID(), expectedVersion: (await row()).stockVersion, quantity: 1 };
   await c.olga.send('POST', movesA, lost);
   const reconciled = await c.olga.get(a('/movements/' + lost.eventId));
   assert.equal(reconciled.statusCode, 200);
   assert.equal(reconciled.json().balanceAfter, 6);
   assert.equal((await c.olga.get(a('/movements/' + randomUUID()))).statusCode, 404, 'não registrado: 404, seguro reenviar o mesmo id');
   assert.equal((await c.bob.get(b('/movements/' + lost.eventId))).statusCode, 404, 'evento de A não aparece em B');
   const stale = await c.alice.send('POST', movesA, { ...m, eventId: randomUUID(), expectedVersion: before.stockVersion });
   assert.equal(stale.statusCode, 409); assert.equal(stale.json().error, 'version_conflict');
   assert.deepEqual(stale.json().current, { quantity: 6, stockVersion: (await row()).stockVersion });
   const events = async () => (await c.alice.get(movesA + '?productId=' + rice)).json().total;
   const count = await events();
   const negative = await c.alice.send('POST', movesA, { ...m, eventId: randomUUID(), expectedVersion: (await row()).stockVersion, quantity: 999 });
   assert.equal(negative.statusCode, 409); assert.equal(negative.json().error, 'insufficient_balance');
   assert.equal((await row()).quantity, 6);
   assert.equal(await events(), count, 'rollback: nenhum evento gravado');
  });

  await t.test('duas sessões no mesmo produto: uma confirma, a outra recebe conflito sem sobrescrever', async () => {
   const item = (await c.alice.get(stockA + '?q=AUR-001')).json().items[0];
   const body = (who: string) => ({ eventId: randomUUID(), productId: rice, expectedVersion: item.stockVersion, kind: 'receipt', quantity: 5, reason: 'Recebimento ' + who });
   const [x, y] = await Promise.all([c.alice.send('POST', movesA, body('alice')), c.olga.send('POST', movesA, body('olga'))]);
   assert.deepEqual([x.statusCode, y.statusCode].sort(), [200, 409]);
   const after = (await c.olga.get(stockA + '?q=AUR-001')).json().items[0];
   assert.equal(after.quantity, item.quantity + 5);
   // Produto e movimentação feitos por uma sessão aparecem na outra sessão autorizada.
   const seen = (await c.vera.get(movesA + '?limit=1')).json().items[0];
   assert.equal(seen.productId, rice);
  });

  await t.test('catálogo e histórico paginados no servidor, sem truncar em 1.000 nem 200', async () => {
   await admin.query('BEGIN');
   await admin.query("SELECT set_config('app.org_id', $1, true)", [A.organizationId]);
   await admin.query(`INSERT INTO products(organization_id, id, name, sku, unit, minimum, quantity, category)
    SELECT $1, gen_random_uuid(), 'Item em massa ' || lpad(n::text, 4, '0'), 'BULK-' || n, 'un', 1, 0, 'Massa' FROM generate_series(1, 1005) n`, [A.organizationId]);
   await admin.query('COMMIT');
   const first = (await c.vera.get(stockA + '?limit=100')).json();
   assert.ok(first.counts.all >= 1008);
   let seen = first.items.length, cursor = first.nextCursor;
   while (cursor) { const page = (await c.vera.get(stockA + '?limit=100&cursor=' + encodeURIComponent(cursor))).json(); seen += page.items.length; cursor = page.nextCursor; }
   assert.equal(seen, first.counts.all, 'todas as páginas somam o catálogo inteiro');
   const search = (await c.vera.get(stockA + '?q=' + encodeURIComponent('CAFE'))).json();
   assert.deepEqual(search.items.map((i: { sku: string }) => i.sku), ['aur-002'], 'busca sem acento no servidor');
   assert.equal((await c.vera.get(stockA + '?q=' + encodeURIComponent('100%'))).json().counts.all, 0, 'curingas escapados');
   assert.ok((await c.vera.get(stockA + '?status=critical')).json().items.every((i: { quantity: number; minimum: number }) => i.quantity < i.minimum));
   assert.equal((await c.vera.get(stockA + '?cursor=lixo')).statusCode, 400);
   for (let i = 0; i < 205; i++) {
    const item = (await c.alice.get(stockA + '?q=AUR-001')).json().items[0];
    const r = await c.alice.send('POST', movesA, { eventId: randomUUID(), productId: rice, expectedVersion: item.stockVersion, kind: 'receipt', quantity: 1, reason: 'Contagem ' + i });
    assert.equal(r.statusCode, 200);
   }
   const history = (await c.vera.get(movesA + '?limit=100')).json();
   assert.ok(history.total > 205);
   let all = history.items.length, next = history.nextCursor;
   const ids = new Set(history.items.map((i: { eventId: string }) => i.eventId));
   while (next) { const page = (await c.vera.get(movesA + '?limit=100&cursor=' + encodeURIComponent(next))).json(); page.items.forEach((i: { eventId: string }) => ids.add(i.eventId)); all += page.items.length; next = page.nextCursor; }
   assert.equal(all, history.total); assert.equal(ids.size, history.total, 'sem repetição entre páginas');
  });

  await t.test('configuração versionada e logotipo isolados por organização', async () => {
   const ctx = (await c.alice.get(a('/context'))).json();
   const upload = await c.alice.send('POST', a('/logo'), pngImage(64, 32), { 'content-type': 'image/png' });
   assert.equal(upload.statusCode, 201);
   assert.deepEqual([upload.json().width, upload.json().height], [64, 32]);
   const next = { ...ctx.settings.settings, identity: { ...ctx.settings.settings.identity, displayName: 'Mercado Aurora Centro', logoAssetId: upload.json().assetId } };
   const saved = await c.alice.send('PUT', a('/settings'), { expectedVersion: ctx.settings.version, settings: next });
   assert.equal(saved.statusCode, 200);
   assert.equal(saved.json().version, ctx.settings.version + 1);
   const stale = await c.alice.send('PUT', a('/settings'), { expectedVersion: ctx.settings.version, settings: next });
   assert.equal(stale.statusCode, 409); assert.equal(stale.json().error, 'settings_conflict');
   const logo = await c.vera.get(saved.json().logoUrl);
   assert.equal(logo.statusCode, 200); assert.equal(logo.headers['content-type'], 'image/png');
   assert.equal(logo.headers['x-content-type-options'], 'nosniff');
   assert.equal((await c.bob.get(saved.json().logoUrl)).statusCode, 403);
   assert.equal((await c.bob.get(b('/assets/' + upload.json().assetId))).statusCode, 404, 'id do logo de A não existe em B');
   const bctx = (await c.bob.get(b('/context'))).json();
   assert.equal(bctx.settings.settings.identity.displayName, 'Adega Vértice');
   assert.equal(bctx.settings.settings.appearance.palette, 'navy');
   const steal = { ...bctx.settings.settings, identity: { ...bctx.settings.settings.identity, logoAssetId: upload.json().assetId } };
   assert.equal((await c.bob.send('PUT', b('/settings'), { expectedVersion: bctx.settings.version, settings: steal })).statusCode, 422);
   const svg = await c.alice.send('POST', a('/logo'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { 'content-type': 'image/svg+xml' });
   assert.equal(svg.statusCode, 415); assert.equal(svg.json().error, 'invalid_image');
   const spoof = await c.alice.send('POST', a('/logo'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { 'content-type': 'image/png' });
   assert.equal(spoof.statusCode, 422);
   assert.equal((await c.alice.send('POST', a('/logo'), pngImage(2000, 20), { 'content-type': 'image/png' })).statusCode, 422);
   assert.equal((await c.alice.send('POST', a('/logo'), Buffer.alloc(300_000, 1), { 'content-type': 'image/png' })).statusCode, 413);
   const bad = { ...next, appearance: { ...next.appearance, palette: 'url(javascript:alert(1))' } };
   assert.equal((await c.alice.send('PUT', a('/settings'), { expectedVersion: saved.json().version, settings: bad })).statusCode, 400);
   const prefs = await c.vera.send('PUT', '/api/me/preferences', { mode: 'dark', density: 'organization' });
   assert.equal(prefs.statusCode, 200);
   assert.equal((await c.alice.get('/api/me')).json().preferences.mode, 'organization', 'preferência pessoal não vaza para outra pessoa');
   const template = settingsFromTemplate('bar', 'Bar Teste');
   assert.equal(template.appearance.density, 'compact');
  });

  await t.test('regressão: reenvios simultâneos do mesmo cadastro não viram erro de código duplicado', async () => {
   const p = { id: randomUUID(), name: 'Feijão carioca · 1 kg', sku: 'CONC-' + randomUUID().slice(0, 6), unit: 'un', minimum: 3, category: 'Mercearia' };
   const results = await Promise.all([1, 2, 3, 4].map(() => c.alice.send('POST', a('/products'), p)));
   assert.deepEqual(results.map(r => r.statusCode), [201, 201, 201, 201]);
   const twins = await Promise.all(['x', 'X'].map(sfx => c.alice.send('POST', a('/products'), { ...p, id: randomUUID(), sku: p.sku + sfx })));
   assert.deepEqual(twins.map(r => r.statusCode).sort(), [201, 409], 'códigos que diferem só em maiúsculas: um entra, o outro é recusado');
   assert.equal(twins.find(r => r.statusCode === 409)!.json().error, 'duplicate_sku');
   const stock = (await c.alice.get(stockA + '?q=' + p.sku)).json();
   assert.equal(stock.items.filter((i: { id: string }) => i.id === p.id).length, 1);
  });

  await t.test('regressão: personalização não concede acesso e não altera outra empresa', async () => {
   const ctx = (await c.alice.get(a('/context'))).json();
   const bBefore = (await c.bob.get(b('/context'))).json().settings;
   // Módulos fazem parte da identidade da empresa: gestor não altera.
   const fewer = { ...ctx.settings.settings, modules: ['overview', 'inventory'], navigation: { landing: 'overview' } };
   assert.equal((await c.mary.send('PUT', a('/settings'), { expectedVersion: ctx.settings.version, settings: fewer })).statusCode, 403);
   const saved = await c.alice.send('PUT', a('/settings'), { expectedVersion: ctx.settings.version, settings: { ...fewer, identity: { ...fewer.identity, segment: 'bar' } } });
   assert.equal(saved.statusCode, 200);
   // Regressão: o segmento exibido acompanha a configuração salva, em /context e em /me.
   assert.equal((await c.alice.get(a('/context'))).json().organization.segment, 'bar');
   assert.equal((await c.alice.get('/api/me')).json().organizations.find((o: { id: string }) => o.id === A.organizationId).segment, 'bar');
   // Esconder "Movimentações" do menu não tira a permissão do operador, nem dá permissão à consulta.
   const level = (await c.olga.get(stockA + '?q=AUR-001')).json().items[0];
   assert.equal((await c.olga.send('POST', movesA, { eventId: randomUUID(), productId: level.id, expectedVersion: level.stockVersion, kind: 'receipt', quantity: 1, reason: 'Teste de módulo' })).statusCode, 200);
   assert.equal((await c.vera.send('POST', movesA, { eventId: randomUUID(), productId: level.id, expectedVersion: level.stockVersion + 1, kind: 'receipt', quantity: 1, reason: 'Teste' })).statusCode, 403);
   // Campos de autorização não são aceitos na configuração.
   const escalate = { ...saved.json().settings, roles: { [people.vera.subject]: 'owner' } };
   assert.equal((await c.alice.send('PUT', a('/settings'), { expectedVersion: saved.json().version, settings: escalate })).statusCode, 400);
   const bAfter = (await c.bob.get(b('/context'))).json().settings;
   assert.deepEqual([bAfter.version, bAfter.settings], [bBefore.version, bBefore.settings], 'empresa B intacta');
   // Restaura os módulos de A para os testes seguintes.
   assert.equal((await c.alice.send('PUT', a('/settings'), { expectedVersion: saved.json().version, settings: ctx.settings.settings })).statusCode, 200);
  });

  await t.test('histórico isolado: eventos de A não aparecem em B', async () => {
   const bHistory = (await c.bob.get(b(`/units/${B.unitId}/movements`))).json();
   assert.equal(bHistory.total, 0);
   assert.equal((await c.bob.get(b(`/units/${B.unitId}/stock`))).json().counts.all, 1);
  });

  await t.test('exportação administrativa: só a empresa pedida, completa e auditada', async () => {
   const out = await exportOrganization(admin, { org: A.organizationId });
   const json = JSON.stringify(out);
   assert.equal(out.organization.id, A.organizationId);
   assert.ok(!json.includes(B.organizationId), 'nenhuma referência à outra empresa');
   for (const [table, rows] of Object.entries(out.tables)) {
    assert.ok((rows as Array<{ organization_id: string }>).every(r => r.organization_id === A.organizationId), table);
   }
   const db = await admin.query(`SELECT (SELECT count(*) FROM products WHERE organization_id=$1)::int AS products,
    (SELECT count(*) FROM inventory_events WHERE organization_id=$1)::int AS events, (SELECT count(*) FROM memberships WHERE organization_id=$1)::int AS members`, [A.organizationId]);
   assert.deepEqual([out.counts.products, out.counts.inventory_events, out.counts.memberships], [db.rows[0].products, db.rows[0].events, db.rows[0].members]);
   assert.ok(out.counts.products > 0 && out.counts.inventory_events > 0);
   const logo = (out.tables.organization_assets as Array<{ content: string; byte_size: number }>)[0];
   if (logo) assert.equal(Buffer.from(logo.content, 'base64').length, logo.byte_size, 'logotipo em base64 íntegro');
   const audit = await admin.query("SELECT count(*)::int AS n FROM audit_log WHERE organization_id=$1 AND action='org.exported'", [A.organizationId]);
   assert.equal(audit.rows[0].n, 1);
   await assert.rejects(exportOrganization(admin, { org: randomUUID() }), /não encontrada/);
  });

  await t.test('papel de runtime: sem RLS bypass, histórico imutável e saldo do cadastro congelado', async () => {
   const db = await pool.connect();
   try {
    assert.equal((await db.query('SELECT count(*)::int AS n FROM products')).rows[0].n, 0, 'sem app.org_id nada é visível');
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.org_id', $1, true)", [A.organizationId]);
    await assert.rejects(db.query('UPDATE inventory_events SET reason=$1', ['x']), /permission denied/);
    await db.query('ROLLBACK');
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.org_id', $1, true)", [A.organizationId]);
    await assert.rejects(db.query('UPDATE products SET quantity=99'), /permission denied/);
    await db.query('ROLLBACK');
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.org_id', $1, true)", [A.organizationId]);
    await assert.rejects(db.query("INSERT INTO memberships(organization_id, subject, issuer, role) VALUES($1,'x','y','owner')", [A.organizationId]), /permission denied/);
    await db.query('ROLLBACK');
   } finally { db.release(); }
   // Mesmo o dono das tabelas não altera eventos: o gatilho append-only protege.
   await admin.query('BEGIN');
   await admin.query("SELECT set_config('app.org_id', $1, true)", [A.organizationId]);
   await assert.rejects(admin.query('DELETE FROM inventory_events WHERE organization_id=$1', [A.organizationId]), /somente inserção/);
   await admin.query('ROLLBACK');
  });

  await t.test('reinício: novo processo e novo pool preservam sessão, dados e histórico', async () => {
   const before = (await c.vera.get(movesA + '?limit=1')).json();
   await app.close(); await pool.end();
   pool = runtime(); app = make(pool);
   for (const who of Object.keys(c)) c[who] = clientFor(app, c[who].cookie, c[who].csrf);
   const vera = c.vera;
   const after = (await vera.get(movesA + '?limit=1')).json();
   assert.equal(after.total, before.total);
   assert.equal(after.items[0].eventId, before.items[0].eventId);
   assert.equal((await vera.get(stockA + '?q=AUR-001')).json().items[0].sku, 'AUR-001');
  });

  await t.test('expiração, logout e invalidação de sessão', async () => {
   await admin.query("UPDATE sessions SET idle_expires_at=now() - interval '1 second' WHERE subject=$1", [people.mary.subject]);
   const expired = await c.mary.get('/api/me');
   assert.equal(expired.statusCode, 401); assert.equal(expired.json().error, 'session_expired');
   const out = await c.olga.send('POST', '/auth/logout');
   assert.equal(out.statusCode, 200);
   assert.match(out.json().redirectTo, /\/logout\?post_logout_redirect_uri=/);
   assert.equal((await c.olga.get('/api/me')).statusCode, 401, 'cookie antigo não vale depois do logout');
   const forced = await app.inject({ method: 'POST', url: '/auth/logout', cookies: { vv_session: c.vera.cookie }, headers: { origin: APP_ORIGIN } });
   assert.equal(forced.statusCode, 403, 'logout também exige CSRF');
   assert.equal(await revokeSessions(admin, { issuer, subject: people.vera.subject }), 1);
   assert.equal((await c.vera.get('/api/me')).statusCode, 401, 'invalidação administrativa');
   const stored = await admin.query('SELECT id_hash, id_token_hint FROM sessions WHERE subject=$1', [people.olga.subject]);
   assert.equal(stored.rows[0].id_hash.length, 32);
   assert.equal(stored.rows[0].id_token_hint, null, 'logout apaga o id_token guardado no servidor');
   assert.notEqual(stored.rows[0].id_hash.toString('base64url'), c.olga.cookie, 'banco guarda só o hash');
  });
 } finally {
  await app.close();
  await pool.end();
  await admin.end();
 }
});
