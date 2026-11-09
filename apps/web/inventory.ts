import { applyMovement, type Product } from '../../packages/domain';
import { MAX_MOVEMENTS, type Business, type DemoMovement } from './demo';

export type StockFilter = 'all' | 'critical' | 'ok';
export type MovementKind = DemoMovement['kind'];

export const kindLabel: Record<MovementKind, string> = { receipt: 'Entrada', issue: 'Saída' };

/** Sugestões de motivo: preenchem o campo, não substituem a escrita livre. */
export const reasonSuggestions: Record<MovementKind, string[]> = {
 receipt: ['Recebimento de fornecedor', 'Ajuste de contagem', 'Devolução de cliente'],
 issue: ['Venda no balcão', 'Consumo interno', 'Perda ou avaria', 'Ajuste de contagem']
};

/** Minúsculas e sem acentos: "cafe" encontra "Café torrado". */
export function normalize(text: string) {
 return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export const isBelowMinimum = (p: Product) => p.quantity < p.minimum;

export function matchesQuery(p: Product, query: string) {
 const q = normalize(query);
 return !q || normalize(`${p.name} ${p.sku} ${p.category}`).includes(q);
}

export function filterProducts(products: Product[], query: string, filter: StockFilter) {
 return products.filter(p => matchesQuery(p, query) && (filter === 'all' || (filter === 'critical') === isBelowMinimum(p)));
}

/** Termo sem espaços e com dígito parece código interno; o resto vira nome. */
export function prefillFromSearch(term: string): { name?: string; sku?: string } {
 const clean = term.trim().slice(0, 120);
 if (!clean) return {};
 return /\d/.test(clean) && !/\s/.test(clean) ? { sku: clean.slice(0, 40).toUpperCase() } : { name: clean };
}

export type MovementRequest = { productId: string; kind: MovementKind; quantity: number; reason: string };

/**
 * Aplica uma movimentação demonstrativa usando a mesma regra de saldo do domínio.
 * Lança erro se o produto não existir ou o saldo ficar inválido; nada é alterado nesse caso.
 */
export function registerMovement(business: Business, request: MovementRequest, id: string, at: Date): { business: Business; movement: DemoMovement } {
 const product = business.products.find(p => p.id === request.productId);
 if (!product) throw new Error('Produto não encontrado nesta empresa.');
 const after = applyMovement(product.quantity, { eventId: id, productId: product.id, expectedVersion: 0, kind: request.kind, quantity: request.quantity, reason: request.reason });
 const movement: DemoMovement = {
  id, productId: product.id, product: product.name, unit: product.unit, kind: request.kind,
  quantity: request.quantity, before: product.quantity, after, reason: request.reason.trim(), at: at.toISOString()
 };
 return {
  movement,
  business: {
   ...business,
   products: business.products.map(p => (p.id === product.id ? { ...p, quantity: after } : p)),
   movements: [movement, ...business.movements].slice(0, MAX_MOVEMENTS)
  }
 };
}

export const formatQuantity = (n: number) => n.toLocaleString('pt-BR');
