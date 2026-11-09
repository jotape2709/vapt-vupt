import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';

/**
 * Aplica, em uma única transação, as migrations de db/migrations ainda não registradas.
 * Migrations aplicadas nunca são editadas: correções entram como um novo arquivo.
 * Depois, se o papel de grupo vv_app existir, aplica os grants mínimos de db/grants/runtime.sql.
 */
const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('Defina MIGRATION_DATABASE_URL com a conta de migração.');
const dir = new URL('../../db/migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
const pool = new Pool({ connectionString });
const db = await pool.connect();
try {
 await db.query('BEGIN');
 await db.query('SELECT pg_advisory_xact_lock(7102401)');
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const applied = new Set((await db.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map(r => r.version));
 for (const file of files) {
  const version = file.slice(0, 3);
  if (applied.has(version)) continue;
  await db.query(await readFile(new URL(file, dir), 'utf8'));
  await db.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
  console.info(`Migration ${version} aplicada (${file}).`);
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
