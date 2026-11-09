import { z } from 'zod';
import { MovementSchema, ProductSchema, modules } from './index';

/* ------------------------------------------------------------------------------------------
 * Contratos compartilhados entre API e interface. O servidor valida a entrada com estes
 * esquemas e a interface valida as respostas; mudar um lado sem o outro falha nos testes.
 * ---------------------------------------------------------------------------------------- */

export const uuid = z.string().uuid();

/* ---------- Papéis e permissões ---------- */

export const roles = ['owner', 'manager', 'operator', 'viewer'] as const;
export type RoleName = (typeof roles)[number];

export const permissions = [
 'catalog.read', 'stock.read', 'history.read', 'settings.read',
 'stock.move', 'product.create', 'settings.appearance', 'settings.identity', 'logo.upload'
] as const;
export type Permission = (typeof permissions)[number];

/**
 * Matriz de autorização aplicada no servidor (docs/AUTHORIZATION.md).
 * Módulos habilitados só organizam a navegação: nunca entram nesta decisão.
 */
export const roleMatrix: Record<RoleName, readonly Permission[]> = {
 viewer: ['catalog.read', 'stock.read', 'history.read', 'settings.read'],
 operator: ['catalog.read', 'stock.read', 'history.read', 'settings.read', 'stock.move'],
 manager: ['catalog.read', 'stock.read', 'history.read', 'settings.read', 'stock.move', 'product.create', 'settings.appearance'],
 owner: permissions
};
export const can = (role: RoleName, permission: Permission) => roleMatrix[role].includes(permission);

export const roleLabels: Record<RoleName, string> = { owner: 'Proprietário', manager: 'Gestor', operator: 'Operador', viewer: 'Consulta' };

/* ---------- Configuração por empresa ---------- */

export const segments = ['market', 'wine_shop', 'bar', 'other'] as const;
export type Segment = (typeof segments)[number];
export const segmentLabels: Record<Segment, string> = { market: 'Mercado', wine_shop: 'Adega', bar: 'Bar e cozinha', other: 'Comércio' };

/** Paletas controladas. A evolução prevista é um conjunto de tokens validados, nunca CSS livre. */
export const palettes = ['blue', 'navy', 'sky'] as const;
export const overviewBlocks = ['quick_find', 'metrics', 'priority', 'recent', 'daily_note'] as const;
export type OverviewBlock = (typeof overviewBlocks)[number];
export type ModuleName = (typeof modules)[number];

const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const OrgSettingsSchema = z.object({
 schemaVersion: z.literal(2),
 identity: z.object({
  displayName: z.string().trim().min(2).max(60),
  segment: z.enum(segments),
  logoAssetId: uuid.nullable()
 }).strict(),
 appearance: z.object({
  palette: z.enum(palettes),
  mode: z.enum(['light', 'dark']),
  font: z.enum(['humanist', 'system']),
  density: z.enum(['comfortable', 'compact'])
 }).strict(),
 modules: z.array(z.enum(modules)).min(1).max(modules.length).refine(unique, 'Módulos repetidos.').refine(m => m.includes('overview'), 'A visão geral é obrigatória.'),
 navigation: z.object({ landing: z.enum(modules) }).strict(),
 overview: z.object({ blocks: z.array(z.enum(overviewBlocks)).max(overviewBlocks.length).refine(unique, 'Blocos repetidos.') }).strict(),
 catalog: z.object({ suggestedCategories: z.array(z.string().trim().min(1).max(40)).max(30) }).strict()
}).strict().refine(s => s.modules.includes(s.navigation.landing), { message: 'A página inicial precisa estar entre os módulos habilitados.', path: ['navigation', 'landing'] });
export type OrgSettings = z.infer<typeof OrgSettingsSchema>;

/** Seções que só o proprietário altera. As demais exigem settings.appearance. */
export function changedSections(before: OrgSettings, after: OrgSettings) {
 const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
 return {
  identity: !same(before.identity, after.identity) || !same(before.modules, after.modules),
  appearance: !same(before.appearance, after.appearance) || !same(before.navigation, after.navigation) || !same(before.overview, after.overview) || !same(before.catalog, after.catalog)
 };
}

/** Templates iniciais: a mesma base configurada por segmento, sem cópias por cliente. */
export const templates: Record<Exclude<Segment, 'other'>, Omit<OrgSettings, 'identity'> & { label: string }> = {
 market: {
  label: 'Mercado', schemaVersion: 2,
  appearance: { palette: 'blue', mode: 'light', font: 'humanist', density: 'comfortable' },
  modules: ['overview', 'inventory', 'products', 'movements'],
  navigation: { landing: 'overview' },
  overview: { blocks: ['quick_find', 'metrics', 'priority', 'recent', 'daily_note'] },
  catalog: { suggestedCategories: ['Mercearia', 'Laticínios', 'Hortifrúti', 'Bebidas', 'Limpeza', 'Higiene'] }
 },
 wine_shop: {
  label: 'Adega', schemaVersion: 2,
  appearance: { palette: 'navy', mode: 'dark', font: 'humanist', density: 'comfortable' },
  modules: ['overview', 'inventory', 'products', 'movements'],
  navigation: { landing: 'inventory' },
  overview: { blocks: ['quick_find', 'metrics', 'priority', 'recent'] },
  catalog: { suggestedCategories: ['Vinhos', 'Espumantes', 'Destilados', 'Cervejas', 'Sem álcool'] }
 },
 bar: {
  label: 'Bar e cozinha', schemaVersion: 2,
  appearance: { palette: 'sky', mode: 'light', font: 'system', density: 'compact' },
  modules: ['overview', 'movements', 'inventory', 'products'],
  navigation: { landing: 'movements' },
  overview: { blocks: ['metrics', 'priority', 'recent'] },
  catalog: { suggestedCategories: ['Bebidas', 'Cozinha', 'Descartáveis', 'Limpeza'] }
 }
};

export function settingsFromTemplate(segment: Segment, displayName: string): OrgSettings {
 const { label: _label, ...base } = templates[segment === 'other' ? 'market' : segment];
 return OrgSettingsSchema.parse({ ...structuredClone(base), identity: { displayName, segment, logoAssetId: null } });
}

/* ---------- Preferências pessoais (independentes da empresa) ---------- */

export const UserPreferencesSchema = z.object({
 mode: z.enum(['organization', 'light', 'dark']).default('organization'),
 density: z.enum(['organization', 'comfortable', 'compact']).default('organization')
}).strict();
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/* ---------- Catálogo, saldo e histórico ---------- */

/** Cadastro sem saldo: o saldo só muda por movimentação. */
export const ProductCreateSchema = ProductSchema.omit({ quantity: true }).strict();
export type ProductCreate = z.infer<typeof ProductCreateSchema>;

export const MovementCreateSchema = MovementSchema;
export type MovementCreate = z.infer<typeof MovementCreateSchema>;

export const StockItemSchema = z.object({
 id: uuid, name: z.string(), sku: z.string(), unit: ProductSchema.shape.unit,
 minimum: z.number().int(), category: z.string(),
 quantity: z.number().int(), stockVersion: z.number().int().nonnegative(), catalogVersion: z.number().int().nonnegative()
}).strict();
export type StockItem = z.infer<typeof StockItemSchema>;

export const stockStatuses = ['all', 'critical', 'ok'] as const;
export const StockQuerySchema = z.object({
 q: z.string().trim().max(120).default(''),
 status: z.enum(stockStatuses).default('all'),
 cursor: z.string().max(400).optional(),
 limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();
export type StockQuery = Partial<z.infer<typeof StockQuerySchema>>;

export const StockPageSchema = z.object({
 organizationId: uuid, unitId: z.string(),
 items: z.array(StockItemSchema),
 nextCursor: z.string().nullable(),
 counts: z.object({ all: z.number().int(), critical: z.number().int(), ok: z.number().int(), catalog: z.number().int() }).strict()
}).strict();
export type StockPage = z.infer<typeof StockPageSchema>;

export const MovementRecordSchema = z.object({
 eventId: uuid, organizationId: uuid, unitId: z.string(), productId: uuid,
 productName: z.string(), productSku: z.string(), measure: ProductSchema.shape.unit,
 kind: z.enum(['receipt', 'issue']), quantity: z.number().int().positive(), reason: z.string(),
 balanceBefore: z.number().int(), balanceAfter: z.number().int(), stockVersion: z.number().int(),
 recordedAt: z.string(), actorName: z.string().nullable()
}).strict();
export type MovementRecord = z.infer<typeof MovementRecordSchema>;

export const MovementQuerySchema = z.object({
 productId: uuid.optional(),
 kind: z.enum(['receipt', 'issue']).optional(),
 cursor: z.string().max(400).optional(),
 limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();
export type MovementQuery = Partial<z.infer<typeof MovementQuerySchema>>;

export const MovementPageSchema = z.object({
 organizationId: uuid, unitId: z.string(),
 items: z.array(MovementRecordSchema), nextCursor: z.string().nullable(), total: z.number().int()
}).strict();
export type MovementPage = z.infer<typeof MovementPageSchema>;

export const MovementResultSchema = z.object({
 status: z.literal('confirmed'), replayed: z.boolean(), movement: MovementRecordSchema
}).strict();
export type MovementResult = z.infer<typeof MovementResultSchema>;

/* ---------- Sessão, contexto e organizações ---------- */

export const SessionSchema = z.object({
 authenticated: z.literal(true),
 user: z.object({ name: z.string().nullable(), email: z.string().nullable(), subject: z.string(), issuer: z.string() }).strict(),
 csrfToken: z.string().min(32),
 idleExpiresAt: z.string(), absoluteExpiresAt: z.string()
}).strict();
export type Session = z.infer<typeof SessionSchema>;

export const OrganizationSummarySchema = z.object({
 id: uuid, displayName: z.string(), segment: z.enum(segments), role: z.enum(roles)
}).strict();
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;

export const MeSchema = z.object({
 user: z.object({ name: z.string().nullable(), email: z.string().nullable() }).strict(),
 preferences: UserPreferencesSchema,
 lastOrganizationId: uuid.nullable(),
 organizations: z.array(OrganizationSummarySchema)
}).strict();
export type Me = z.infer<typeof MeSchema>;

export const UnitSchema = z.object({ id: uuid, name: z.string(), isPrimary: z.boolean() }).strict();

export const SettingsEnvelopeSchema = z.object({
 organizationId: uuid, version: z.number().int().positive(), settings: OrgSettingsSchema,
 updatedAt: z.string(), logoUrl: z.string().nullable()
}).strict();
export type SettingsEnvelope = z.infer<typeof SettingsEnvelopeSchema>;

export const ContextSchema = z.object({
 organization: z.object({ id: uuid, displayName: z.string(), segment: z.enum(segments) }).strict(),
 role: z.enum(roles),
 permissions: z.array(z.enum(permissions)),
 unit: UnitSchema,
 units: z.array(UnitSchema),
 unitPolicy: z.literal('single-unit-pilot'),
 settings: SettingsEnvelopeSchema
}).strict();
export type Context = z.infer<typeof ContextSchema>;

export const SettingsUpdateSchema = z.object({ expectedVersion: z.number().int().positive(), settings: OrgSettingsSchema }).strict();

export const LogoResultSchema = z.object({
 assetId: uuid, url: z.string(), width: z.number().int(), height: z.number().int(), byteSize: z.number().int(), contentType: z.string()
}).strict();
export type LogoResult = z.infer<typeof LogoResultSchema>;

/* ---------- Erros ---------- */

export const errorCodes = [
 'unauthenticated', 'session_expired', 'csrf_rejected', 'forbidden', 'not_found', 'validation',
 'version_conflict', 'event_payload_conflict', 'insufficient_balance', 'duplicate_sku',
 'settings_conflict', 'invalid_image', 'rate_limited', 'server_error'
] as const;
export type ErrorCode = (typeof errorCodes)[number];
export const ErrorBodySchema = z.object({
 error: z.enum(errorCodes), message: z.string(),
 current: z.object({ quantity: z.number().int(), stockVersion: z.number().int() }).strict().optional(),
 currentVersion: z.number().int().optional(),
 fields: z.record(z.string(), z.string()).optional()
}).strict();
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

/** Limites de logotipo aplicados no servidor (o navegador só antecipa a mensagem). */
export const logoLimits = { maxBytes: 262144, minSide: 16, maxSide: 1024, types: ['image/png', 'image/jpeg', 'image/webp'] as const };
