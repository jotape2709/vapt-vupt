import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

/**
 * Banco descartável já migrado (npm run db:migrate). Cria o papel de grupo vv_app se faltar,
 * aplica os mesmos grants da produção e devolve um pool que opera COMO vv_app (SET ROLE):
 * sem superusuário, sem BYPASSRLS e sem ownership. Nunca apontar para um banco real.
 */
export async function testDatabase(adminUrl: string) {
 const admin = new Pool({ connectionString: adminUrl, max: 4 });
 await admin.query(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='vv_app') THEN CREATE ROLE vv_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 END $$`);
 await admin.query(await readFile(new URL('../../db/grants/runtime.sql', import.meta.url), 'utf8'));
 const runtime = () => new Pool({ connectionString: adminUrl, options: '-c role=vv_app', max: 8 });
 return { admin, runtime };
}
