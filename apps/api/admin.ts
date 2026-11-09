import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import { roles, segments, settingsFromTemplate } from '../../packages/domain/contracts';

/**
 * Administração do piloto: provisionamento restrito, transacional e auditado.
 * Usa a conta administrativa (ADMIN_DATABASE_URL), nunca a conta de runtime da API.
 * Não existe cadastro público de organizações nesta fase.
 *
 *   npm run admin -- provision --name "Mercado Aurora" --segment market --unit "Loja Centro" \
 *     --owner-issuer https://idp.exemplo/realms/vapt --owner-subject <sub> [--org-id <uuid>]
 *   npm run admin -- grant --org <uuid> --issuer <iss> --subject <sub> --role operator
 *   npm run admin -- revoke --org <uuid> --issuer <iss> --subject <sub>
 *   npm run admin -- revoke-sessions --issuer <iss> --subject <sub>
 *   npm run admin -- export --org <uuid> > empresa.json   (portabilidade/encerramento)
 */
const actor = 'admin-cli:' + (process.env.VV_ADMIN_ACTOR || userInfo().username);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const identity = { issuer: z.string().url().max(255), subject: text(1, 255) };

const ProvisionSchema = z.object({
 name: text(2, 60), segment: z.enum(segments), unit: text(2, 60).default('Unidade principal'),
 'owner-issuer': identity.issuer, 'owner-subject': identity.subject, 'org-id': z.string().uuid().optional()
}).strict();
const GrantSchema = z.object({ org: z.string().uuid(), issuer: identity.issuer, subject: identity.subject, role: z.enum(roles) }).strict();
const RevokeSchema = z.object({ org: z.string().uuid(), issuer: identity.issuer, subject: identity.subject }).strict();
const ExportSchema = z.object({ org: z.string().uuid() }).strict();
const SessionsSchema = z.object({ issuer: identity.issuer, subject: identity.subject }).strict();

async function inOrg<T>(pool: Pool, org: string, fn: (db: PoolClient) => Promise<T>) {
 const db = await pool.connect();
 try {
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.org_id', $1, true)", [org]);
  const result = await fn(db);
  await db.query('COMMIT');
  return result;
 } catch (e) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw e;
 } finally { db.release(); }
}

const audit = (db: PoolClient, org: string, action: string, entity: string, metadata: Record<string, unknown>) =>
 db.query('INSERT INTO audit_log(organization_id, subject, action, entity_id, metadata) VALUES($1,$2,$3,$4,$5::jsonb)', [org, actor, action, entity, JSON.stringify(metadata)]);

export async function provision(pool: Pool, input: z.input<typeof ProvisionSchema>) {
 const p = ProvisionSchema.parse(input);
 const org = p['org-id'] ?? randomUUID(), unit = randomUUID();
 const settings = settingsFromTemplate(p.segment, p.name);
 await inOrg(pool, org, async db => {
  await db.query('INSERT INTO organizations(id, name, segment, settings_version) VALUES($1,$2,$3,1)', [org, p.name, p.segment]);
  await db.query('INSERT INTO organization_settings(organization_id, version, settings, created_by) VALUES($1,1,$2::jsonb,$3)', [org, JSON.stringify(settings), actor]);
  await db.query('INSERT INTO units(organization_id, id, name, is_primary) VALUES($1,$2,$3,true)', [org, unit, p.unit]);
  await db.query("INSERT INTO memberships(organization_id, subject, issuer, role) VALUES($1,$2,$3,'owner')", [org, p['owner-subject'], p['owner-issuer']]);
  await audit(db, org, 'org.provisioned', org, { name: p.name, segment: p.segment, unitId: unit, owner: { issuer: p['owner-issuer'], subject: p['owner-subject'] } });
 });
 return { organizationId: org, unitId: unit };
}

export async function grant(pool: Pool, input: z.input<typeof GrantSchema>) {
 const g = GrantSchema.parse(input);
 await inOrg(pool, g.org, async db => {
  const exists = await db.query('SELECT 1 FROM organizations WHERE id=$1', [g.org]);
  if (!exists.rowCount) throw new Error('Organização não encontrada.');
  await db.query(`INSERT INTO memberships(organization_id, subject, issuer, role) VALUES($1,$2,$3,$4)
   ON CONFLICT (organization_id, subject, issuer) DO UPDATE SET role=EXCLUDED.role`, [g.org, g.subject, g.issuer, g.role]);
  await audit(db, g.org, 'membership.granted', g.org, { issuer: g.issuer, subject: g.subject, role: g.role });
 });
}

export async function revoke(pool: Pool, input: z.input<typeof RevokeSchema>) {
 const r = RevokeSchema.parse(input);
 await inOrg(pool, r.org, async db => {
  const removed = await db.query('DELETE FROM memberships WHERE organization_id=$1 AND subject=$2 AND issuer=$3', [r.org, r.subject, r.issuer]);
  if (!removed.rowCount) throw new Error('Membership não encontrada.');
  await audit(db, r.org, 'membership.revoked', r.org, { issuer: r.issuer, subject: r.subject });
 });
}

export async function revokeSessions(pool: Pool, input: z.input<typeof SessionsSchema>) {
 const s = SessionsSchema.parse(input);
 const result = await pool.query("UPDATE sessions SET revoked_at=now(), revoked_reason='admin', id_token_hint=NULL WHERE issuer=$1 AND subject=$2 AND revoked_at IS NULL", [s.issuer, s.subject]);
 return result.rowCount ?? 0;
}

/**
 * Exportação completa dos dados de UMA empresa, em JSON legível, para portabilidade ou encerramento
 * do serviço. Cada consulta filtra explicitamente pela organização (além da RLS de app.org_id), então
 * nenhuma linha de outra empresa entra no arquivo, mesmo com uma conta que ignore a RLS.
 * Logotipos saem em base64. Sessões e transações de login (efêmeras) não são exportadas.
 */
const exportTables: Array<[table: string, orderBy: string]> = [
 ['organization_settings', 'version'], ['units', 'id'], ['memberships', 'role, issuer, subject'],
 ['products', 'sku'], ['stock_levels', 'unit_id, product_id'], ['inventory_events', 'created_at, id'],
 ['organization_assets', 'created_at, id'], ['audit_log', 'id']
];
export async function exportOrganization(pool: Pool, input: z.input<typeof ExportSchema>) {
 const e = ExportSchema.parse(input);
 return inOrg(pool, e.org, async db => {
  const org = await db.query('SELECT * FROM organizations WHERE id=$1', [e.org]);
  if (!org.rowCount) throw new Error('Organização não encontrada.');
  const tables: Record<string, unknown[]> = {};
  for (const [table, orderBy] of exportTables) {
   const rows = (await db.query(`SELECT * FROM ${table} WHERE organization_id=$1 ORDER BY ${orderBy}`, [e.org])).rows;
   tables[table] = rows.map(r => (Buffer.isBuffer(r.content) ? { ...r, content: r.content.toString('base64') } : r));
  }
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  await audit(db, e.org, 'org.exported', e.org, { counts });
  return { format: 'vapt-vupt-organization-export', formatVersion: 1, exportedAt: new Date().toISOString(), organization: org.rows[0], counts, tables };
 });
}
