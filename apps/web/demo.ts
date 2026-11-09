import { z } from 'zod';
import { ThemeSchema, ProductSchema, type Theme, type Product } from '../../packages/domain';

/** Registro do histórico demonstrativo. Fica só no navegador e não é trilha de auditoria. */
export const DemoMovementSchema = z.object({
 id: z.string().min(1).max(64),
 productId: z.string().uuid(),
 product: z.string().trim().min(1).max(120),
 unit: ProductSchema.shape.unit,
 kind: z.enum(['receipt', 'issue']),
 quantity: z.number().int().positive().max(1000000),
 before: z.number().int().min(0).max(1000000),
 after: z.number().int().min(0).max(1000000),
 reason: z.string().trim().min(3).max(160),
 at: z.string().datetime()
}).strict();
export type DemoMovement = z.infer<typeof DemoMovementSchema>;
export type Business = { id: string; segment: string; theme: Theme; products: Product[]; movements: DemoMovement[] };

/** Limites para manter o armazenamento local pequeno e previsível. */
export const MAX_BUSINESSES = 10;
export const MAX_MOVEMENTS = 200;

const product = (id: number, name: string, sku: string, quantity: number, minimum: number, category: string, unit: Product['unit'] = 'un'): Product =>
 ({ id: '00000000-0000-4000-8000-' + String(id).padStart(12, '0'), name, sku, quantity, minimum, category, unit });

export function initialBusinesses(): Business[] {
 return [
  { id: 'mercado', segment: 'Mercado', theme: { version: 1, name: 'Mercado Aurora', accent: 'blue', mode: 'light', density: 'comfortable', font: 'humanist', modules: ['overview', 'inventory', 'products', 'movements', 'purchases', 'quotes', 'team'] }, movements: [], products: [
   product(1, 'Arroz branco · 5 kg', 'AUR-001', 8, 20, 'Mercearia'),
   product(2, 'Café torrado · 500 g', 'AUR-002', 6, 12, 'Mercearia'),
   product(3, 'Leite integral · 1 L', 'AUR-003', 36, 24, 'Laticínios'),
   product(4, 'Óleo de soja · 900 ml', 'AUR-004', 18, 12, 'Mercearia'),
   product(5, 'Feijão carioca · 1 kg', 'AUR-005', 4, 15, 'Mercearia'),
   product(6, 'Detergente neutro · 500 ml', 'AUR-006', 42, 10, 'Limpeza')
  ] },
  { id: 'adega', segment: 'Adega', theme: { version: 1, name: 'Adega Vértice', accent: 'navy', mode: 'dark', density: 'comfortable', font: 'humanist', modules: ['overview', 'inventory', 'products', 'movements', 'quotes'] }, movements: [], products: [
   product(11, 'Vinho tinto seco · 750 ml', 'VER-001', 5, 12, 'Vinhos'),
   product(12, 'Cerveja pilsen · caixa 12', 'VER-002', 24, 10, 'Cervejas', 'cx'),
   product(13, 'Água com gás · 500 ml', 'VER-003', 8, 20, 'Sem álcool'),
   product(14, 'Suco de uva · 1 L', 'VER-004', 16, 8, 'Sem álcool')
  ] },
  { id: 'bar', segment: 'Bar e cozinha', theme: { version: 1, name: 'Bar da Esquina', accent: 'sky', mode: 'light', density: 'compact', font: 'system', modules: ['overview', 'inventory', 'products', 'movements', 'purchases'] }, movements: [], products: [
   product(21, 'Água tônica · 350 ml', 'ESQ-001', 6, 18, 'Bebidas'),
   product(22, 'Arroz branco · 1 kg', 'ESQ-002', 20, 12, 'Cozinha'),
   product(23, 'Guardanapo · pacote', 'ESQ-003', 3, 10, 'Descartáveis'),
   product(24, 'Óleo de soja · 900 ml', 'ESQ-004', 12, 6, 'Cozinha')
  ] }
 ];
}

// Chave atual e chave anterior (lida uma vez para migrar dados salvos por versões antigas da demo).
export const STORAGE_KEY = 'vv-demo-v1';
const LEGACY_STORAGE_KEY = 'vv-next-demo-v1';
const legacyAccents: Record<string, string> = { forest: 'blue', wine: 'navy', copper: 'sky' };

/** Movimentos inválidos são descartados um a um: um registro corrompido não apaga o resto. */
function parseMovements(value: unknown): DemoMovement[] {
 if (!Array.isArray(value)) return [];
 return value.slice(0, MAX_MOVEMENTS).flatMap(item => {
  const result = DemoMovementSchema.safeParse(item);
  return result.success ? [result.data] : [];
 });
}

/**
 * Valida dados vindos do navegador. Qualquer empresa inválida faz a demo voltar ao estado inicial,
 * porque catálogo e tema são a base de todas as telas.
 */
export function parseStoredDemo(data: unknown): Business[] {
 if (!Array.isArray(data) || data.length === 0 || data.length > MAX_BUSINESSES) return initialBusinesses();
 try {
  return data.map((raw: Partial<Business>) => {
   const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64 ? raw.id : null;
   if (!id || !raw.theme) throw new Error('Empresa inválida');
   const accent = legacyAccents[raw.theme.accent] || raw.theme.accent;
   return {
    id,
    segment: typeof raw.segment === 'string' ? raw.segment.slice(0, 40) : 'Comércio',
    theme: ThemeSchema.parse({ ...raw.theme, accent }),
    products: ProductSchema.array().max(1000).parse(raw.products),
    movements: parseMovements(raw.movements)
   };
  });
 } catch {
  return initialBusinesses();
 }
}

export function loadDemo(): Business[] {
 try {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  return raw ? parseStoredDemo(JSON.parse(raw)) : initialBusinesses();
 } catch {
  return initialBusinesses();
 }
}

/** Somente preferências e dados fictícios. Nunca credenciais ou autorização. */
export function saveDemo(businesses: Business[]) {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses.map(b => ({ ...b, movements: b.movements.slice(0, MAX_MOVEMENTS) }))));
 localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function clearDemo() {
 localStorage.removeItem(STORAGE_KEY);
 localStorage.removeItem(LEGACY_STORAGE_KEY);
}
