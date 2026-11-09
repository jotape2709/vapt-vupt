import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
 changedSections, OrgSettingsSchema, roleMatrix, StockQuerySchema, MovementQuerySchema, UserPreferencesSchema,
 type Context, type LogoResult, type Me, type MovementCreate, type MovementPage, type MovementRecord, type MovementResult,
 type OrgSettings, type ProductCreate, type SettingsEnvelope, type StockItem, type StockPage, type StockQuery, type MovementQuery, type UserPreferences
} from '../../packages/domain/contracts';
import type { Database, Identity } from './db';
import { ApiError, forbidden, notFound } from './errors';
import { inspectImage } from './images';

const MAX_BALANCE = 1_000_000;

/* ---------- Cursores opacos de paginação (keyset) ---------- */

function encodeCursor(values: (string | number)[]) { return Buffer.from(JSON.stringify(values)).toString('base64url'); }
function decodeCursor(cursor: string | undefined, shape: ('string' | 'number')[]): (string | number)[] | null {
 if (!cursor) return null;
 try {
  const values = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (Array.isArray(values) && values.length === shape.length && values.every((v, i) => typeof v === shape[i] && String(v).length <= 200)) return values;
 } catch { /* cai no erro abaixo */ }
 throw new ApiError(400, 'validation', 'Cursor de paginação inválido. Recarregue a lista.');
}

const likeEscape = (text: string) => text.replace(/[\\%_]/g, m => '\\' + m);

type EventRow = {
 id: string; organization_id: string; unit_id: string; product_id: string; name: string; sku: string; measure: string;
 kind: 'receipt' | 'issue'; quantity: number; reason: string; balance_before: number; balance_after: number;
 stock_version: number; created_at: Date; created_cursor: string; actor_name: string | null;
};
const EVENT_COLUMNS = `e.id, e.organization_id, e.unit_id, e.product_id, p.name, p.sku, p.unit AS measure, e.kind, e.quantity, e.reason,
 e.balance_before, e.balance_after, e.stock_version, e.created_at, e.actor_name,
 to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_cursor`;
const toRecord = (r: EventRow): MovementRecord => ({
 eventId: r.id, organizationId: r.organization_id, unitId: r.unit_id, productId: r.product_id,
 productName: r.name, productSku: r.sku, measure: r.measure as MovementRecord['measure'],
 kind: r.kind, quantity: r.quantity, reason: r.reason, balanceBefore: r.balance_before, balanceAfter: r.balance_after,
 stockVersion: r.stock_version, recordedAt: r.created_at.toISOString(), actorName: r.actor_name
});

async function audit(db: PoolClient, org: string, identity: Identity, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
 await db.query('INSERT INTO audit_log(organization_id, subject, action, entity_id, metadata) VALUES($1,$2,$3,$4,$5::jsonb)',
  [org, identity.subject, action, entityId, JSON.stringify({ issuer: identity.issuer, ...metadata })]);
}

async function requireUnit(db: PoolClient, org: string, unitId: string) {
 const r = await db.query<{ id: string; name: string }>('SELECT id, name FROM units WHERE organization_id=$1 AND id=$2', [org, unitId]);
 if (!r.rows[0]) throw notFound('Unidade');
 return r.rows[0];
}

/**
 * Regras operacionais. Cada método abre uma transação com o escopo da organização,
 * confirma membership e permissão no banco e só então lê ou escreve.
 */
export class Operations {
 constructor(private readonly db: Database) {}

 /* ---------- Usuário e empresas autorizadas ---------- */

 async upsertUser(identity: Identity, email: string | null) {
  await this.db.asIdentity(identity, db => db.query(
   `INSERT INTO users(issuer, subject, display_name, email, last_login_at) VALUES($1,$2,$3,$4,now())
    ON CONFLICT (issuer, subject) DO UPDATE SET display_name=EXCLUDED.display_name, email=EXCLUDED.email, last_login_at=now()`,
   [identity.issuer, identity.subject, identity.name, email]));
 }

 me(identity: Identity): Promise<Me> {
  return this.db.asIdentity(identity, async db => {
   const user = (await db.query('SELECT display_name, email, preferences, last_organization_id FROM users WHERE issuer=$1 AND subject=$2', [identity.issuer, identity.subject])).rows[0];
   // Somente as memberships da própria identidade (política self_select) e suas organizações.
   const orgs = await db.query<{ id: string; role: Me['organizations'][number]['role']; segment: Me['organizations'][number]['segment']; settings: OrgSettings }>(
    `SELECT o.id, m.role, s.settings->'identity'->>'segment' AS segment, s.settings
     FROM memberships m
     JOIN organizations o ON o.id = m.organization_id
     JOIN organization_settings s ON s.organization_id = o.id AND s.version = o.settings_version
     WHERE m.subject=$1 AND m.issuer=$2
     ORDER BY lower(s.settings->'identity'->>'displayName'), o.id`, [identity.subject, identity.issuer]);
   const prefs = UserPreferencesSchema.safeParse(user?.preferences ?? {});
   return {
    user: { name: user?.display_name ?? identity.name, email: user?.email ?? null },
    preferences: prefs.success ? prefs.data : UserPreferencesSchema.parse({}),
    lastOrganizationId: orgs.rows.some(o => o.id === user?.last_organization_id) ? user.last_organization_id : null,
    organizations: orgs.rows.map(o => ({ id: o.id, role: o.role, segment: o.segment, displayName: o.settings.identity.displayName }))
   };
  });
 }

 savePreferences(identity: Identity, preferences: UserPreferences) {
  return this.db.asIdentity(identity, async db => {
   await db.query('UPDATE users SET preferences=$3::jsonb WHERE issuer=$1 AND subject=$2', [identity.issuer, identity.subject, JSON.stringify(preferences)]);
   return preferences;
  });
 }

 /* ---------- Contexto e configuração da empresa ---------- */

 private async envelope(db: PoolClient, org: string): Promise<SettingsEnvelope> {
  const r = await db.query<{ version: number; settings: OrgSettings; created_at: Date }>(
   `SELECT s.version, s.settings, s.created_at FROM organizations o
    JOIN organization_settings s ON s.organization_id=o.id AND s.version=o.settings_version WHERE o.id=$1`, [org]);
  const row = r.rows[0];
  if (!row) throw notFound('Configuração');
  const settings = OrgSettingsSchema.parse(row.settings);
  return {
   organizationId: org, version: row.version, settings, updatedAt: row.created_at.toISOString(),
   logoUrl: settings.identity.logoAssetId ? `/api/orgs/${org}/assets/${settings.identity.logoAssetId}` : null
  };
 }

 context(identity: Identity, org: string): Promise<Context> {
  return this.db.asMember(identity, org, 'settings.read', async (db, member) => {
   const envelope = await this.envelope(db, org);
   const units = (await db.query<{ id: string; name: string; is_primary: boolean }>('SELECT id, name, is_primary FROM units WHERE organization_id=$1 ORDER BY is_primary DESC, name', [org])).rows
    .map(u => ({ id: u.id, name: u.name, isPrimary: u.is_primary }));
   const unit = units.find(u => u.isPrimary) ?? units[0];
   if (!unit) throw notFound('Unidade');
   await db.query('UPDATE users SET last_organization_id=$3 WHERE issuer=$1 AND subject=$2', [identity.issuer, identity.subject, org]);
   return {
    // O segmento vigente é o da configuração versionada (organizations.segment guarda só o inicial).
    organization: { id: org, displayName: envelope.settings.identity.displayName, segment: envelope.settings.identity.segment },
    role: member.role, permissions: [...roleMatrix[member.role]],
    unit, units, unitPolicy: 'single-unit-pilot', settings: envelope
   };
  });
 }

 updateSettings(identity: Identity, org: string, expectedVersion: number, next: OrgSettings): Promise<SettingsEnvelope> {
  return this.db.asMember(identity, org, 'settings.read', async (db, member) => {
   const locked = await db.query<{ settings_version: number }>('SELECT settings_version FROM organizations WHERE id=$1 FOR UPDATE', [org]);
   const current = await this.envelope(db, org);
   if (locked.rows[0].settings_version !== expectedVersion) {
    throw new ApiError(409, 'settings_conflict', 'A configuração foi alterada por outra pessoa. Recarregue e revise antes de salvar.', { currentVersion: current.version });
   }
   const changed = changedSections(current.settings, next);
   const allowed = roleMatrix[member.role];
   if ((changed.identity && !allowed.includes('settings.identity')) || (changed.appearance && !allowed.includes('settings.appearance'))) throw forbidden();
   if (!changed.identity && !changed.appearance) return current;
   if (next.identity.logoAssetId && next.identity.logoAssetId !== current.settings.identity.logoAssetId) {
    const asset = await db.query("SELECT 1 FROM organization_assets WHERE organization_id=$1 AND id=$2 AND kind='logo'", [org, next.identity.logoAssetId]);
    if (!asset.rowCount) throw new ApiError(422, 'validation', 'Logotipo não encontrado nesta empresa.', { fields: { logo: 'Envie o logotipo novamente.' } });
   }
   const version = expectedVersion + 1;
   await db.query('INSERT INTO organization_settings(organization_id, version, settings, created_by) VALUES($1,$2,$3::jsonb,$4)', [org, version, JSON.stringify(next), identity.subject]);
   await db.query('UPDATE organizations SET settings_version=$2 WHERE id=$1', [org, version]);
   await audit(db, org, identity, 'settings.updated', org, { version, identity: changed.identity, appearance: changed.appearance });
   return this.envelope(db, org);
  });
 }

 uploadLogo(identity: Identity, org: string, bytes: Buffer, declaredType: string | undefined): Promise<LogoResult> {
  return this.db.asMember(identity, org, 'logo.upload', async db => {
   const info = inspectImage(bytes, declaredType);
   const id = randomUUID();
   const sha256 = createHash('sha256').update(bytes).digest('hex');
   await db.query(
    `INSERT INTO organization_assets(organization_id, id, kind, content_type, byte_size, width, height, sha256, content, created_by)
     VALUES($1,$2,'logo',$3,$4,$5,$6,$7,$8,$9)`, [org, id, info.contentType, bytes.length, info.width, info.height, sha256, bytes, identity.subject]);
   await audit(db, org, identity, 'logo.uploaded', id, { sha256, bytes: bytes.length, width: info.width, height: info.height });
   return { assetId: id, url: `/api/orgs/${org}/assets/${id}`, width: info.width, height: info.height, byteSize: bytes.length, contentType: info.contentType };
  });
 }

 asset(identity: Identity, org: string, assetId: string) {
  return this.db.asMember(identity, org, 'settings.read', async db => {
   const r = await db.query<{ content_type: string; content: Buffer; sha256: string }>('SELECT content_type, content, sha256 FROM organization_assets WHERE organization_id=$1 AND id=$2', [org, assetId]);
   if (!r.rows[0]) throw notFound('Arquivo');
   return r.rows[0];
  });
 }

 /* ---------- Catálogo e saldo ---------- */

 stock(identity: Identity, org: string, unitId: string, raw: StockQuery): Promise<StockPage> {
  const query = StockQuerySchema.parse(raw);
  return this.db.asMember(identity, org, 'stock.read', async db => {
   await requireUnit(db, org, unitId);
   const pattern = query.q ? '%' + likeEscape(query.q) + '%' : '';
   const status = query.status === 'critical' ? 'AND coalesce(s.quantity,0) < p.minimum' : query.status === 'ok' ? 'AND coalesce(s.quantity,0) >= p.minimum' : '';
   const after = decodeCursor(query.cursor, ['string', 'string']);
   const base = `FROM products p LEFT JOIN stock_levels s ON s.organization_id=p.organization_id AND s.unit_id=$2 AND s.product_id=p.id
    WHERE p.organization_id=$1 AND ($3 = '' OR p.search_text LIKE vv_normalize($3) ESCAPE '\\')`;
   const rows = await db.query(
    `SELECT p.id, p.name, p.sku, p.unit, p.minimum, p.category, p.version AS catalog_version,
      coalesce(s.quantity,0) AS quantity, coalesce(s.version,0) AS stock_version, lower(p.name) AS sort_name
     ${base} ${status} ${after ? 'AND (lower(p.name), p.id) > ($4, $5::uuid)' : ''}
     ORDER BY lower(p.name), p.id LIMIT ${query.limit + 1}`,
    after ? [org, unitId, pattern, after[0], after[1]] : [org, unitId, pattern]);
   const counts = (await db.query<{ all: number; critical: number }>(
    `SELECT count(*)::int AS all, count(*) FILTER (WHERE coalesce(s.quantity,0) < p.minimum)::int AS critical ${base}`, [org, unitId, pattern])).rows[0];
   const catalog = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM products WHERE organization_id=$1', [org])).rows[0].n;
   const page = rows.rows.slice(0, query.limit);
   const last = page[page.length - 1];
   return {
    organizationId: org, unitId,
    items: page.map((r): StockItem => ({ id: r.id, name: r.name, sku: r.sku, unit: r.unit, minimum: r.minimum, category: r.category, quantity: r.quantity, stockVersion: r.stock_version, catalogVersion: r.catalog_version })),
    nextCursor: rows.rows.length > query.limit && last ? encodeCursor([last.sort_name, last.id]) : null,
    counts: { all: counts.all, critical: counts.critical, ok: counts.all - counts.critical, catalog }
   };
  });
 }

 createProduct(identity: Identity, org: string, input: ProductCreate): Promise<StockItem> {
  return this.db.asMember(identity, org, 'product.create', async db => {
   // Cadastros da mesma empresa são serializados: dois reenvios simultâneos do mesmo cadastro
   // (ou dois códigos que diferem só em maiúsculas) não chegam a disputar a chave única.
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['product-create:' + org]);
   // Repetição do mesmo cadastro (resposta perdida) devolve o produto existente sem duplicar.
   const prior = await db.query('SELECT name, sku, unit, minimum, category, version FROM products WHERE organization_id=$1 AND id=$2', [org, input.id]);
   if (prior.rows[0]) {
    const p = prior.rows[0];
    if (p.name !== input.name || p.sku !== input.sku || p.unit !== input.unit || p.minimum !== input.minimum || p.category !== input.category) {
     throw new ApiError(409, 'event_payload_conflict', 'Identificador de produto já utilizado com outro conteúdo.');
    }
    return { ...input, quantity: 0, stockVersion: 0, catalogVersion: p.version };
   }
   const sku = await db.query('SELECT 1 FROM products WHERE organization_id=$1 AND lower(sku)=lower($2)', [org, input.sku]);
   if (sku.rowCount) throw new ApiError(409, 'duplicate_sku', 'Este código já existe nesta empresa.', { fields: { sku: 'Este código já existe nesta empresa.' } });
   await db.query('INSERT INTO products(organization_id, id, name, sku, unit, minimum, quantity, category) VALUES($1,$2,$3,$4,$5,$6,0,$7)',
    [org, input.id, input.name, input.sku, input.unit, input.minimum, input.category]);
   await db.query('INSERT INTO stock_levels(organization_id, unit_id, product_id) SELECT $1, u.id, $2 FROM units u WHERE u.organization_id=$1', [org, input.id]);
   await audit(db, org, identity, 'product.created', input.id, { sku: input.sku });
   return { ...input, quantity: 0, stockVersion: 0, catalogVersion: 0 };
  });
 }

 /* ---------- Movimentações ---------- */

 /**
  * Transação: autorização → unidade → lock do evento → busca idempotente → lock do saldo →
  * versão esperada → saldo → evento imutável e auditoria. Qualquer falha desfaz tudo.
  */
 move(identity: Identity, org: string, unitId: string, m: MovementCreate): Promise<MovementResult> {
  return this.db.asMember(identity, org, 'stock.move', async db => {
   await requireUnit(db, org, unitId);
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [org + ':' + m.eventId]);
   const prior = await db.query(`SELECT ${EVENT_COLUMNS}, e.expected_version FROM inventory_events e
    JOIN products p ON p.organization_id=e.organization_id AND p.id=e.product_id WHERE e.organization_id=$1 AND e.id=$2`, [org, m.eventId]);
   if (prior.rows[0]) {
    const p = prior.rows[0];
    const same = p.unit_id === unitId && p.product_id === m.productId && p.kind === m.kind && p.quantity === m.quantity && p.reason === m.reason && p.expected_version === m.expectedVersion;
    if (!same) throw new ApiError(409, 'event_payload_conflict', 'Este identificador de operação já foi usado com outro conteúdo. Nada foi alterado.');
    return { status: 'confirmed', replayed: true, movement: toRecord(p) };
   }
   const product = await db.query<{ name: string; sku: string; unit: string }>('SELECT name, sku, unit FROM products WHERE organization_id=$1 AND id=$2', [org, m.productId]);
   if (!product.rows[0]) throw notFound('Produto');
   await db.query('INSERT INTO stock_levels(organization_id, unit_id, product_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [org, unitId, m.productId]);
   const level = (await db.query<{ quantity: number; version: number }>(
    'SELECT quantity, version FROM stock_levels WHERE organization_id=$1 AND unit_id=$2 AND product_id=$3 FOR UPDATE', [org, unitId, m.productId])).rows[0];
   const current = { quantity: level.quantity, stockVersion: level.version };
   if (level.version !== m.expectedVersion) {
    throw new ApiError(409, 'version_conflict', 'O saldo deste produto mudou desde que você abriu o formulário. Confira o saldo atual antes de registrar.', { current });
   }
   const after = level.quantity + (m.kind === 'receipt' ? m.quantity : -m.quantity);
   if (after < 0) throw new ApiError(409, 'insufficient_balance', `A saída é maior que o saldo disponível (${level.quantity} ${product.rows[0].unit}). Nada foi alterado.`, { current });
   if (after > MAX_BALANCE) throw new ApiError(409, 'insufficient_balance', 'O saldo ultrapassaria o limite de 1.000.000. Nada foi alterado.', { current });
   const version = level.version + 1;
   await db.query('UPDATE stock_levels SET quantity=$4, version=$5, updated_at=now() WHERE organization_id=$1 AND unit_id=$2 AND product_id=$3', [org, unitId, m.productId, after, version]);
   const result = { eventId: m.eventId, quantity: after, version, status: 'confirmed' };
   const inserted = await db.query<{ created_at: Date }>(
    `INSERT INTO inventory_events(organization_id, id, product_id, payload, result, subject, unit_id, kind, quantity, reason,
      expected_version, balance_before, balance_after, stock_version, actor_issuer, actor_name)
     VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING created_at`,
    [org, m.eventId, m.productId, JSON.stringify({ ...m, unitId }), JSON.stringify(result), identity.subject, unitId, m.kind, m.quantity, m.reason,
     m.expectedVersion, level.quantity, after, version, identity.issuer, identity.name]);
   await audit(db, org, identity, 'inventory.' + m.kind, m.eventId, { unitId, productId: m.productId, quantity: m.quantity });
   return {
    status: 'confirmed', replayed: false,
    movement: {
     eventId: m.eventId, organizationId: org, unitId, productId: m.productId, productName: product.rows[0].name, productSku: product.rows[0].sku,
     measure: product.rows[0].unit as MovementRecord['measure'], kind: m.kind, quantity: m.quantity, reason: m.reason,
     balanceBefore: level.quantity, balanceAfter: after, stockVersion: version, recordedAt: inserted.rows[0].created_at.toISOString(), actorName: identity.name
    }
   };
  });
 }

 /** Reconciliação depois de timeout: o evento existe (confirmado) ou não existe (não registrado). */
 movement(identity: Identity, org: string, eventId: string): Promise<MovementRecord> {
  return this.db.asMember(identity, org, 'history.read', async db => {
   const r = await db.query<EventRow>(`SELECT ${EVENT_COLUMNS} FROM inventory_events e
    JOIN products p ON p.organization_id=e.organization_id AND p.id=e.product_id WHERE e.organization_id=$1 AND e.id=$2`, [org, eventId]);
   if (!r.rows[0]) throw notFound('Operação');
   return toRecord(r.rows[0]);
  });
 }

 movements(identity: Identity, org: string, unitId: string, raw: MovementQuery): Promise<MovementPage> {
  const query = MovementQuerySchema.parse(raw);
  return this.db.asMember(identity, org, 'history.read', async db => {
   await requireUnit(db, org, unitId);
   const params: unknown[] = [org, unitId];
   let filter = '';
   if (query.productId) { params.push(query.productId); filter += ` AND e.product_id=$${params.length}`; }
   if (query.kind) { params.push(query.kind); filter += ` AND e.kind=$${params.length}`; }
   const total = (await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM inventory_events e WHERE e.organization_id=$1 AND e.unit_id=$2${filter}`, params)).rows[0].total;
   const after = decodeCursor(query.cursor, ['string', 'string']);
   const pageParams = [...params];
   let keyset = '';
   if (after) { pageParams.push(after[0], after[1]); keyset = ` AND (e.created_at, e.id) < ($${pageParams.length - 1}::timestamptz, $${pageParams.length}::uuid)`; }
   const rows = await db.query<EventRow>(`SELECT ${EVENT_COLUMNS} FROM inventory_events e
    JOIN products p ON p.organization_id=e.organization_id AND p.id=e.product_id
    WHERE e.organization_id=$1 AND e.unit_id=$2${filter}${keyset}
    ORDER BY e.created_at DESC, e.id DESC LIMIT ${query.limit + 1}`, pageParams);
   const page = rows.rows.slice(0, query.limit);
   const last = page[page.length - 1];
   return {
    organizationId: org, unitId, total, items: page.map(toRecord),
    nextCursor: rows.rows.length > query.limit && last ? encodeCursor([last.created_cursor, last.id]) : null
   };
  });
 }
}
