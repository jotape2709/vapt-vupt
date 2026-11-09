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
// Conexões ociosas recebem erro quando o PostgreSQL reinicia. Sem este ouvinte o processo inteiro
// cairia; com ele, o pool descarta a conexão e as próximas requisições abrem outra.
pool.on('error', err => { console.warn(`Conexão ociosa com o banco encerrada: ${err.message}`); });

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
// O provedor pode subir depois da API (ex.: docker compose): tenta por até ~1 minuto e então falha.
let oidc;
for (let attempt = 1; ; attempt++) {
 try { oidc = await createOidcProvider(config.oidc); break; }
 catch (err) {
  if (attempt >= 30) { await pool.end(); throw err; }
  console.warn(`Provedor OIDC indisponível (tentativa ${attempt}/30): ${(err as Error).message}`);
  await new Promise(r => setTimeout(r, 2000));
 }
}
const app = buildApp(
 { ops: new Operations(db), sessions: new SessionStore(db, config.session), oidc },
 { appOrigin: config.appOrigin, secureCookies: config.secureCookies, webDistDir: config.webDistDir ? resolve(config.webDistDir) : undefined, trustProxy: config.trustProxy }
);
// Prontidão: banco alcançável com o papel de runtime. O provedor OIDC já foi descoberto antes do listen.
app.get('/ready', async (_req, reply) => {
 try { await pool.query('SELECT 1'); return { status: 'ready' }; }
 catch { return reply.code(503).send({ status: 'unavailable', dependency: 'database' }); }
});
app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close(); });
await app.listen({ host: config.host, port: config.port });
