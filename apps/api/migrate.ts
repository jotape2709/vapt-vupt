import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { listMigrations } from './migrations';
import { connectionFromEnv } from './pg-connection';

/**
 * Aplica, em uma única transação, as migrations de db/migrations ainda não registradas.
 * Migrations aplicadas nunca são editadas: correções entram como um novo arquivo.
 * Depois, se o papel de grupo vv_app existir, aplica os grants mínimos de db/grants/runtime.sql.
 * A compatibilidade declarada de cada migration nova (apps/api/migrations.ts) fica registrada em
 * schema_migrations.previous_compatible, lida pela API ao iniciar.
 */
const connectionString = connectionFromEnv('MIGRATION_DATABASE');
if (!connectionString) throw new Error('Defina MIGRATION_DATABASE_URL (e MIGRATION_DATABASE_PASSWORD) com a conta de migração.');
const dir = new URL('../../db/migrations/', import.meta.url);
const migrations = await listMigrations(dir);
const pool = new Pool({ connectionString });
const db = await pool.connect();
try {
 await db.query('BEGIN');
 await db.query('SELECT pg_advisory_xact_lock(7102401)');
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 // Registro da compatibilidade declarada: lido pela API ao iniciar (versão anterior sobre schema novo).
 await db.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS previous_compatible boolean');
 const applied = new Set((await db.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map(r => r.version));
 for (const m of migrations) {
  if (applied.has(m.version)) continue;
  await db.query(await readFile(new URL(m.file, dir), 'utf8'));
  await db.query('INSERT INTO schema_migrations(version, previous_compatible) VALUES($1, $2)',
   [m.version, m.compat === undefined ? null : m.compat === 'sim']);
  console.info(`Migration ${m.version} aplicada (${m.file}; compatibilidade com a versão anterior: ${m.compat ?? 'não declarada'}).`);
 }
 const role = await db.query("SELECT 1 FROM pg_roles WHERE rolname='vv_app'");
 if (role.rowCount) {
  await db.query(await readFile(new URL('../../db/grants/runtime.sql', import.meta.url), 'utf8'));
  console.info('Grants de runtime aplicados ao papel vv_app.');
 } else {
  console.info('Papel vv_app ausente: grants de runtime não aplicados (ver docs/LOCAL-DEV.md).');
 }
 await db.query('COMMIT');
 console.info('Schema atualizado.');
} catch (e) {
 await db.query('ROLLBACK');
 throw e;
} finally {
 db.release();
 await pool.end();
}
