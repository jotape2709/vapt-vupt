import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialBusinesses, parseStoredDemo, MAX_MOVEMENTS } from '../apps/web/demo';
import { filterProducts, normalize, prefillFromSearch, registerMovement } from '../apps/web/inventory';

const mercado = () => initialBusinesses()[0];
const arroz = '00000000-0000-4000-8000-000000000001';
const at = new Date('2026-11-09T12:00:00Z');
const uid = (n: number) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('busca ignora acentos e maiúsculas e procura em nome, código e categoria', () => {
 const { products } = mercado();
 assert.equal(normalize('  CAFÉ '), 'cafe');
 assert.deepEqual(filterProducts(products, 'cafe', 'all').map(p => p.sku), ['AUR-002']);
 assert.deepEqual(filterProducts(products, 'aur-006', 'all').map(p => p.sku), ['AUR-006']);
 assert.equal(filterProducts(products, 'laticinios', 'all').length, 1);
 assert.equal(filterProducts(products, 'pão de queijo', 'all').length, 0);
});

test('filtros de situação separam abaixo do mínimo e suficiente sem sobreposição', () => {
 const { products } = mercado();
 const critical = filterProducts(products, '', 'critical'), ok = filterProducts(products, '', 'ok');
 assert.deepEqual(critical.map(p => p.sku), ['AUR-001', 'AUR-002', 'AUR-005']);
 assert.equal(critical.length + ok.length, products.length);
});

test('termo sem resultado vira código quando parece código e nome nos demais casos', () => {
 assert.deepEqual(prefillFromSearch('aur-099'), { sku: 'AUR-099' });
 assert.deepEqual(prefillFromSearch('pão de queijo'), { name: 'pão de queijo' });
 assert.deepEqual(prefillFromSearch('   '), {});
});

test('entrada e saída atualizam saldo e histórico com saldo anterior e posterior', () => {
 const first = registerMovement(mercado(), { productId: arroz, kind: 'receipt', quantity: 5, reason: 'Recebimento' }, uid(1), at);
 assert.equal(first.business.products[0].quantity, 13);
 assert.deepEqual([first.movement.before, first.movement.after, first.movement.unit], [8, 13, 'un']);
 const second = registerMovement(first.business, { productId: arroz, kind: 'issue', quantity: 13, reason: 'Venda' }, uid(2), at);
 assert.equal(second.business.products[0].quantity, 0);
 assert.deepEqual(second.business.movements.map(m => m.id), [uid(2), uid(1)]);
});

test('saída acima do saldo e produto inexistente não alteram nada', () => {
 const original = mercado();
 assert.throws(() => registerMovement(original, { productId: arroz, kind: 'issue', quantity: 9, reason: 'Venda' }, uid(1), at));
 assert.throws(() => registerMovement(original, { productId: '00000000-0000-4000-8000-000000000999', kind: 'receipt', quantity: 1, reason: 'Teste' }, uid(1), at), /não encontrado/);
 assert.equal(original.products[0].quantity, 8);
 assert.equal(original.movements.length, 0);
});

test('histórico fica limitado aos registros mais recentes', () => {
 let business = mercado();
 for (let i = 0; i < MAX_MOVEMENTS + 5; i++) business = registerMovement(business, { productId: arroz, kind: 'receipt', quantity: 1, reason: 'Entrada' }, uid(i), at).business;
 assert.equal(business.movements.length, MAX_MOVEMENTS);
 assert.equal(business.movements[0].id, uid(MAX_MOVEMENTS + 4));
});

test('dados salvos: histórico persiste, registros inválidos são descartados e aliases migram', () => {
 const { business } = registerMovement(mercado(), { productId: arroz, kind: 'receipt', quantity: 2, reason: 'Recebimento' }, uid(1), at);
 const stored = JSON.parse(JSON.stringify([{ ...business, theme: { ...business.theme, accent: 'forest' }, movements: [...business.movements, { id: 'x', kind: 'teleport' }] }]));
 const [loaded] = parseStoredDemo(stored);
 assert.equal(loaded.theme.accent, 'blue');
 assert.equal(loaded.products[0].quantity, 10);
 assert.deepEqual(loaded.movements.map(m => m.id), [uid(1)]);
});

test('dados salvos corrompidos voltam ao exemplo inicial', () => {
 for (const bad of [null, [], {}, [{ id: '' }], [{ id: 'x', theme: { accent: 'url(x)' } }], Array(11).fill(mercado())])
  assert.deepEqual(parseStoredDemo(bad).map(b => b.id), ['mercado', 'adega', 'bar']);
});
