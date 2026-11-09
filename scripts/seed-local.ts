import { Pool } from 'pg';
import { connectionFromEnv } from '../apps/api/pg-connection';
import { grant, provision } from '../apps/api/admin';

/**
 * Dados do ambiente LOCAL (docker compose): duas organizações com identidades distintas e
 * usuários do realm de desenvolvimento (docker/keycloak/realm-vapt.json) com funções diferentes.
 * Recusa qualquer emissor fora de localhost: nunca semeia uma instalação real.
 * Não cria produtos nem movimentações: a operação começa vazia, como numa empresa real.
 */
const issuer = process.env.VV_SEED_ISSUER ?? 'http://localhost:8080/realms/vapt';
if (!['localhost', '127.0.0.1'].includes(new URL(issuer).hostname)) throw new Error('seed-local só roda com emissor em localhost.');
const url = connectionFromEnv('ADMIN_DATABASE');
if (!url) throw new Error('Defina ADMIN_DATABASE_URL (e ADMIN_DATABASE_PASSWORD) da conta de migração local.');

const users = { ana: 'a0000000-0000-4000-8000-0000000000a1', bruno: 'a0000000-0000-4000-8000-0000000000b2', carla: 'a0000000-0000-4000-8000-0000000000c3', davi: 'a0000000-0000-4000-8000-0000000000d4' };
const orgs = { aurora: 'b0000000-0000-4000-8000-00000000a001', vertice: 'b0000000-0000-4000-8000-00000000b002' };

const pool = new Pool({ connectionString: url, max: 2 });
try {
 const exists = async (id: string) => {
  const db = await pool.connect();
  try {
   await db.query('BEGIN');
   await db.query("SELECT set_config('app.org_id', $1, true)", [id]);
   const r = await db.query('SELECT 1 FROM organizations WHERE id=$1', [id]);
   await db.query('COMMIT');
   return !!r.rowCount;
  } finally { db.release(); }
 };
 if (!(await exists(orgs.aurora))) {
  await provision(pool, { 'org-id': orgs.aurora, name: 'Mercado Aurora', segment: 'market', unit: 'Loja Centro', 'owner-issuer': issuer, 'owner-subject': users.ana });
  await grant(pool, { org: orgs.aurora, issuer, subject: users.bruno, role: 'operator' });
  await grant(pool, { org: orgs.aurora, issuer, subject: users.davi, role: 'viewer' });
 }
 if (!(await exists(orgs.vertice))) {
  await provision(pool, { 'org-id': orgs.vertice, name: 'Adega Vértice', segment: 'wine_shop', unit: 'Loja Jardins', 'owner-issuer': issuer, 'owner-subject': users.carla });
  await grant(pool, { org: orgs.vertice, issuer, subject: users.ana, role: 'viewer' });
 }
 console.info('Organizações locais prontas: Mercado Aurora (ana proprietária, bruno operador, davi consulta) e Adega Vértice (carla proprietária, ana consulta). eva não tem acesso.');
} finally { await pool.end(); }
