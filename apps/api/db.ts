import type { Pool, PoolClient } from 'pg';
import { can, type Permission, type RoleName } from '../../packages/domain/contracts';
import { forbidden } from './errors';

/** Identidade vinda exclusivamente da sessão de servidor (nunca do navegador). */
export type Identity = { issuer: string; subject: string; name: string | null };
export type Member = { role: RoleName };

/**
 * Acesso ao PostgreSQL com escopo por transação. Os valores app.* são LOCAL à transação,
 * então uma conexão devolvida ao pool não carrega identidade ou organização de outra requisição.
 */
export class Database {
 constructor(readonly pool: Pool) {}

 async transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await this.pool.connect();
  try {
   await db.query('BEGIN');
   const result = await fn(db);
   await db.query('COMMIT');
   return result;
  } catch (e) {
   await db.query('ROLLBACK').catch(() => undefined);
   throw e;
  } finally {
   db.release();
  }
 }

 /** Transação com a identidade da sessão: libera as políticas de autoconsulta (usuário, memberships). */
 asIdentity<T>(identity: Identity, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  return this.transaction(async db => {
   await db.query("SELECT set_config('app.issuer', $1, true), set_config('app.subject', $2, true)", [identity.issuer, identity.subject]);
   return fn(db);
  });
 }

 /**
  * Transação de uma organização. O organizationId vem da URL, mas só vale depois de confirmar,
  * no banco, a membership da identidade da sessão e a permissão exigida pela operação.
  */
 asMember<T>(identity: Identity, organizationId: string, permission: Permission, fn: (db: PoolClient, member: Member) => Promise<T>): Promise<T> {
  return this.transaction(async db => {
   await db.query("SELECT set_config('app.issuer', $1, true), set_config('app.subject', $2, true), set_config('app.org_id', $3, true)", [identity.issuer, identity.subject, organizationId]);
   const row = await db.query<{ role: RoleName }>('SELECT role FROM memberships WHERE organization_id=$1 AND subject=$2 AND issuer=$3', [organizationId, identity.subject, identity.issuer]);
   const role = row.rows[0]?.role;
   // Sem membership e sem permissão respondem igual: não revela se a organização existe.
   if (!role || !can(role, permission)) throw forbidden();
   return fn(db, { role });
  });
 }
}
