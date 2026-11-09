import { resolve } from 'node:path';
import { Pool } from 'pg';
import { buildApp } from './app';
import { loadConfig } from './config';
import { Database } from './db';
import { createOidcProvider } from './oidc';
import { Operations } from './operations';
import { SessionStore } from './sessions';

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

// A API recusa iniciar com papel privilegiado: RLS só protege se o runtime não puder ignorá-la.
const privilege = await pool.query(`SELECT r.rolsuper, r.rolbypassrls,
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND pg_has_role(current_user, c.relowner, 'USAGE')) AS owns_tables,
 EXISTS(SELECT 1 FROM pg_roles g WHERE pg_has_role(current_user, g.oid, 'USAGE') AND (g.rolsuper OR g.rolbypassrls)) AS inherits_bypass
 FROM pg_roles r WHERE r.rolname=current_user`);
const p = privilege.rows[0];
if (!p || p.rolsuper || p.rolbypassrls || p.owns_tables || p.inherits_bypass) {
 await pool.end();
 throw new Error('A API exige papel restrito: sem superusuário, sem BYPASSRLS e sem ownership das tabelas.');
}

const db = new Database(pool);
const oidc = await createOidcProvider(config.oidc);
const app = buildApp(
 { ops: new Operations(db), sessions: new SessionStore(db, config.session), oidc },
 { appOrigin: config.appOrigin, secureCookies: config.secureCookies, webDistDir: config.webDistDir ? resolve(config.webDistDir) : undefined, trustProxy: config.trustProxy }
);
app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close(); });
await app.listen({ host: config.host, port: config.port });
