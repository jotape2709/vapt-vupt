import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { APPLIED_SQL, listMigrations, parseCompat, schemaRefusal, type AppliedRow } from '../apps/api/migrations';

test('declaração de compatibilidade com a versão anterior é lida do cabeçalho', () => {
 assert.equal(parseCompat('-- compatibilidade-anterior: sim — só coluna nova anulável\nALTER TABLE x ADD c int;'), 'sim');
 assert.equal(parseCompat('-- Comentário\n-- compatibilidade-anterior: não - renomeia coluna usada pela versão anterior\n'), 'não');
 assert.equal(parseCompat('-- COMPATIBILIDADE-ANTERIOR: Sim\n'), 'sim');
 assert.equal(parseCompat('ALTER TABLE x ADD c int; -- aditiva'), undefined, '"aditiva" não é declaração de compatibilidade');
 assert.equal(parseCompat('-- compatibilidade-anterior: simples\n'), undefined);
});

test('migration nova sem declaração é recusada; 001 e 002 (anteriores à regra) não são editadas', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'vv-mig-'));
 try {
  await writeFile(join(dir, '001_core.sql'), 'SELECT 1;');
  await writeFile(join(dir, '002_more.sql'), 'SELECT 1;');
  await writeFile(join(dir, '003_new.sql'), 'ALTER TABLE products ADD COLUMN note text;');
  const url = pathToFileURL(dir + '/');
  await assert.rejects(listMigrations(url), /003_new\.sql sem a declaração/);
  await writeFile(join(dir, '003_new.sql'), '-- compatibilidade-anterior: sim — coluna anulável, ignorada pela versão anterior\nALTER TABLE products ADD COLUMN note text;');
  assert.deepEqual((await listMigrations(url)).map(m => [m.version, m.compat]), [['001', undefined], ['002', undefined], ['003', 'sim']]);
 } finally { await rm(dir, { recursive: true }); }
});

test('as migrations do repositório cumprem a regra', async () => {
 const list = await listMigrations(new URL('../db/migrations/', import.meta.url));
 assert.ok(list.length >= 2);
});

test('versão anterior sobre schema novo: só opera se cada migration desconhecida foi declarada compatível', () => {
 const known = ['001', '002'];
 const rows = (...r: [string, boolean | null][]): AppliedRow[] => r.map(([version, previous_compatible]) => ({ version, previous_compatible }));
 assert.equal(schemaRefusal(rows(['001', null], ['002', null]), known), null, 'mesmo schema');
 assert.equal(schemaRefusal(rows(['001', null], ['002', null], ['003', true]), known), null, 'nova migration declarada compatível');
 assert.match(schemaRefusal(rows(['001', null], ['002', null], ['003', true], ['004', false]), known)!, /não foram declaradas compatíveis.*004/);
 assert.match(schemaRefusal(rows(['001', null], ['002', null], ['003', null]), known)!, /003/, 'sem registro de compatibilidade = recusa');
 assert.equal(schemaRefusal(rows(['001', null]), known), null, 'schema mais antigo não é assunto desta verificação');
});

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
test('registro de compatibilidade no banco migrado e legível pelo papel de runtime', { skip: !adminUrl }, async () => {
 const runtime = new Pool({ connectionString: adminUrl, options: '-c role=vv_app', max: 1 });
 try {
  const rows = (await runtime.query<AppliedRow>(APPLIED_SQL)).rows;
  assert.deepEqual(rows.slice(0, 2).map(r => r.version), ['001', '002']);
  const col = await runtime.query("SELECT 1 FROM information_schema.columns WHERE table_name='schema_migrations' AND column_name='previous_compatible'");
  assert.equal(col.rowCount, 1, 'migrate.ts registra a compatibilidade declarada');
  assert.equal(schemaRefusal(rows, ['001', '002']), null);
 } finally { await runtime.end(); }
});
