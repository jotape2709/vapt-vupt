import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { connectionFromEnv, connectionString } from '../apps/api/pg-connection';
import { loadConfig } from '../apps/api/config';

// Mesmo parser que o driver usa ao abrir a conexão.
const ConnectionParameters = createRequire(import.meta.url)('pg/lib/connection-parameters.js');
const names = { url: 'DATABASE_URL', password: 'DATABASE_PASSWORD' };
const tricky = ['a/b@c:d%e', '100%', '%41%zz', 'x@y:z/w?q=1#frag', 'sp ace & "aspas" + = ~ !*()', 'ç€😀', "s'imples", 'só$dólar${X}'];

test('senha com caracteres reservados quebra a URL crua (reprodução do achado)', () => {
 assert.throws(() => new ConnectionParameters({ connectionString: 'postgresql://vv_runtime:a/b@c:d%e@postgres:5432/vapt_vupt' }), /Invalid URL|URI malformed/);
});

test('senha separada chega intacta ao driver, com usuário, host e banco corretos', () => {
 for (const pw of tricky) {
  const p = new ConnectionParameters({ connectionString: connectionString('postgresql://vv_runtime@postgres:5432/vapt_vupt', pw, names) });
  assert.deepEqual([p.user, p.host, p.port, p.database, p.password], ['vv_runtime', 'postgres', 5432, 'vapt_vupt', pw], pw);
 }
});

test('regras: senha em um só lugar, URL inválida e mensagens sem o segredo', () => {
 assert.equal(connectionString('postgresql://u:p@h/db', undefined, names), 'postgresql://u:p@h/db', 'sem senha separada, a URL vale como está');
 assert.throws(() => connectionString('postgresql://u:p@h/db', 'outra', names), /já contém senha; defina-a só em DATABASE_PASSWORD/);
 assert.throws(() => connectionString('mysql://u@h/db', 'x', names), /postgresql:\/\//);
 const secret = 'segredo/@:%' + randomUUID();
 try { connectionString('postgresql://u:' + secret + '@h/db', undefined, names); assert.fail('deveria falhar'); }
 catch (e) { assert.ok(!(e as Error).message.includes(secret), 'mensagem não expõe a senha'); }
 assert.equal(connectionFromEnv('MIGRATION_DATABASE', {}), undefined);
 const env = { MIGRATION_DATABASE_URL: 'postgresql://vv_migrator@pg/db', MIGRATION_DATABASE_PASSWORD: '/@:%' };
 assert.equal(new ConnectionParameters({ connectionString: connectionFromEnv('MIGRATION_DATABASE', env) }).password, '/@:%');
});

test('loadConfig monta a conexão da API a partir de DATABASE_URL + DATABASE_PASSWORD', () => {
 const config = loadConfig({
  DATABASE_URL: 'postgresql://vv_runtime@postgres:5432/vapt_vupt', DATABASE_PASSWORD: 'a/b@c:d%e',
  APP_ORIGIN: 'https://app.example.invalid', OIDC_ISSUER: 'https://login.example.invalid/realms/vapt',
  OIDC_CLIENT_ID: 'vapt-vupt-web', OIDC_CLIENT_SECRET: 'x'.repeat(32)
 });
 assert.equal(new ConnectionParameters({ connectionString: config.databaseUrl }).password, 'a/b@c:d%e');
});

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
test('PostgreSQL real: papel com senha cheia de caracteres reservados autentica pela conexão montada', { skip: !adminUrl }, async () => {
 const admin = new Pool({ connectionString: adminUrl });
 const role = 'vv_pw_' + randomUUID().slice(0, 8);
 const password = `/@:%?#&=+ ${randomUUID()}'"$\\`;
 try {
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD ${(await admin.query('SELECT quote_literal($1) AS q', [password])).rows[0].q}`);
  const u = new URL(adminUrl!); u.username = role; u.password = '';
  const pool = new Pool({ connectionString: connectionString(u.toString(), password, names) });
  try { assert.equal((await pool.query('SELECT current_user AS u')).rows[0].u, role); }
  finally { await pool.end(); }
  const wrong = new Pool({ connectionString: connectionString(u.toString(), password + 'x', names) });
  await assert.rejects(wrong.query('SELECT 1'), /password authentication failed/);
  await wrong.end();
 } finally {
  await admin.query(`DROP ROLE IF EXISTS ${role}`);
  await admin.end();
 }
});
