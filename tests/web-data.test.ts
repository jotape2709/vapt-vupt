import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiGateway } from '../apps/web/data/apiGateway';
import { ApiClient, RequestError } from '../apps/web/data/http';

const A = '30000000-0000-4000-8000-00000000000a', B = '30000000-0000-4000-8000-00000000000b';
const unit = '30000000-0000-4000-8000-0000000000f1';
const page = (org: string) => ({ organizationId: org, unitId: unit, items: [], nextCursor: null, counts: { all: 0, critical: 0, ok: 0, catalog: 0 } });

/** fetch falso controlado pelo teste: cada chamada fica pendente até ser resolvida. */
function fakeFetch() {
 const calls: { url: string; init: RequestInit; resolve: (body: unknown, status?: number) => void }[] = [];
 const original = globalThis.fetch;
 globalThis.fetch = ((url: string, init: RequestInit) => new Promise((resolve, reject) => {
  init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  calls.push({ url, init, resolve: (body, status = 200) => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) });
 })) as typeof fetch;
 return { calls, restore: () => { globalThis.fetch = original; } };
}

test('troca de empresa: resposta atrasada da empresa A nunca chega à empresa B', async () => {
 const f = fakeFetch();
 try {
  const api = new ApiClient(() => undefined);
  const gatewayA = new ApiGateway(api, A, unit);
  const pendingA = gatewayA.listStock({ q: '' });
  gatewayA.dispose();                       // usuário trocou para B
  const gatewayB = new ApiGateway(api, B, unit);
  const pendingB = gatewayB.listStock({ q: '' });
  f.calls[1].resolve(page(B));
  f.calls[0].resolve(page(A));              // chega depois, já descartada
  assert.equal((await pendingB).organizationId, B);
  await assert.rejects(pendingA, (e: RequestError) => e.kind === 'aborted');
 } finally { f.restore(); }
});

test('resposta que declara outra organização é descartada', async () => {
 const f = fakeFetch();
 try {
  const gateway = new ApiGateway(new ApiClient(() => undefined), A, unit);
  const pending = gateway.listStock({});
  f.calls[0].resolve(page(B));
  await assert.rejects(pending, (e: RequestError) => e.kind === 'invalid_response');
 } finally { f.restore(); }
});

test('escrita envia CSRF; timeout e falha de rede deixam o resultado desconhecido', async () => {
 const f = fakeFetch();
 try {
  const api = new ApiClient(() => undefined, 50);
  api.setCsrf('t'.repeat(40));
  const gateway = new ApiGateway(api, A, unit);
  const move = gateway.move({ eventId: A, productId: B, expectedVersion: 0, kind: 'receipt', quantity: 1, reason: 'Teste' });
  assert.equal((f.calls[0].init.headers as Record<string, string>)['X-CSRF-Token'], 't'.repeat(40));
  assert.equal(f.calls[0].init.credentials, 'same-origin');
  await assert.rejects(move, (e: RequestError) => e.kind === 'timeout' && e.outcomeUnknown);
  const conflict = gateway.move({ eventId: A, productId: B, expectedVersion: 0, kind: 'receipt', quantity: 1, reason: 'Teste' });
  f.calls[1].resolve({ error: 'version_conflict', message: 'Saldo mudou.', current: { quantity: 3, stockVersion: 2 } }, 409);
  await assert.rejects(conflict, (e: RequestError) => e.kind === 'version_conflict' && !e.outcomeUnknown && e.body?.current?.stockVersion === 2);
 } finally { f.restore(); }
});

test('sessão expirada em qualquer requisição avisa a aplicação para limpar os dados', async () => {
 const f = fakeFetch();
 try {
  const seen: string[] = [];
  const gateway = new ApiGateway(new ApiClient(kind => seen.push(kind)), A, unit);
  const pending = gateway.listMovements({});
  f.calls[0].resolve({ error: 'session_expired', message: 'Sua sessão terminou.' }, 401);
  await assert.rejects(pending, (e: RequestError) => e.kind === 'session_expired');
  assert.deepEqual(seen, ['session_expired']);
 } finally { f.restore(); }
});

test('reconciliação: 404 significa não registrado (null), não erro', async () => {
 const f = fakeFetch();
 try {
  const gateway = new ApiGateway(new ApiClient(() => undefined), A, unit);
  const pending = gateway.findMovement(B);
  f.calls[0].resolve({ error: 'not_found', message: 'Operação não encontrado.' }, 404);
  assert.equal(await pending, null);
 } finally { f.restore(); }
});
