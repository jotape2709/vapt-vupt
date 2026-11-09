import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { grant, provision, revoke, revokeSessions } from './admin';

/** Linha de comando administrativa. Documentação: docs/OPERATIONS.md. */
const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({ args: rest, strict: true, options: Object.fromEntries(
 ['name', 'segment', 'unit', 'owner-issuer', 'owner-subject', 'org-id', 'org', 'issuer', 'subject', 'role'].map(k => [k, { type: 'string' as const }])) });
const url = process.env.ADMIN_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('Defina ADMIN_DATABASE_URL (conta administrativa, nunca a de runtime).');
const pool = new Pool({ connectionString: url, max: 2 });
try {
 if (command === 'provision') console.info(JSON.stringify(await provision(pool, values as never)));
 else if (command === 'grant') { await grant(pool, values as never); console.info('Membership concedida.'); }
 else if (command === 'revoke') { await revoke(pool, values as never); console.info('Membership removida; o acesso termina na próxima requisição.'); }
 else if (command === 'revoke-sessions') console.info(`${await revokeSessions(pool, values as never)} sessão(ões) encerrada(s).`);
 else { console.error('Comandos: provision | grant | revoke | revoke-sessions. Veja docs/OPERATIONS.md.'); process.exitCode = 2; }
} finally { await pool.end(); }
