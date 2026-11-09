import { readdir, readFile } from 'node:fs/promises';

/**
 * Compatibilidade de cada migration com a versão ANTERIOR da aplicação.
 *
 * "Aditiva" não prova compatibilidade: uma coluna nova NOT NULL sem padrão, um gatilho novo ou um
 * grant revogado quebram a versão anterior sem remover nada. Por isso, a partir da 003, toda
 * migration declara na primeira linha útil:
 *
 *   -- compatibilidade-anterior: sim — <motivo>   (a versão anterior funciona sobre o schema novo;
 *                                                  exige o teste scripts/compat-previous.sh aprovado)
 *   -- compatibilidade-anterior: não — <motivo>   (reverter só a imagem não é seguro; atualização
 *                                                  exige plano de recuperação explícito)
 *
 * 001 e 002 são anteriores à regra e não são editadas (migrations aplicadas são imutáveis).
 * Ver docs/cloud/OPERACAO.md#atualização-e-reversão.
 */
export type Compat = 'sim' | 'não';
export interface MigrationFile { version: string; file: string; compat: Compat | undefined }

export const FIRST_DECLARED_VERSION = '003';
const NAME = /^(\d{3})_[a-z0-9_]+\.sql$/;
const HEADER = /^--\s*compatibilidade-anterior:\s*(sim|não)(?=$|[\s—-])/imu;

export function parseCompat(sql: string): Compat | undefined {
 return (HEADER.exec(sql)?.[1]?.toLowerCase() as Compat | undefined) ?? undefined;
}

export function requiresDeclaration(version: string): boolean {
 return version >= FIRST_DECLARED_VERSION;
}

export async function listMigrations(dir: URL): Promise<MigrationFile[]> {
 const files = (await readdir(dir)).filter(f => NAME.test(f)).sort();
 const result: MigrationFile[] = [];
 for (const file of files) {
  const version = file.slice(0, 3);
  const compat = parseCompat(await readFile(new URL(file, dir), 'utf8'));
  if (requiresDeclaration(version) && !compat) {
   throw new Error(`Migration ${file} sem a declaração "-- compatibilidade-anterior: sim|não". Ver docs/cloud/OPERACAO.md.`);
  }
  result.push({ version, file, compat });
 }
 return result;
}

/** Linhas de schema_migrations. Funciona também antes da coluna previous_compatible existir. */
export const APPLIED_SQL = `SELECT version, (to_jsonb(s)->>'previous_compatible')::boolean AS previous_compatible
 FROM schema_migrations s ORDER BY version`;
export interface AppliedRow { version: string; previous_compatible: boolean | null }

/**
 * Decide se ESTA versão da aplicação pode operar sobre o schema encontrado. Migrations que esta
 * versão desconhece (aplicadas por uma versão mais nova) só são aceitas se foram declaradas
 * compatíveis com a versão anterior. Devolve a mensagem de recusa, ou null se pode operar.
 */
export function schemaRefusal(applied: AppliedRow[], known: string[]): string | null {
 const knownSet = new Set(known);
 const unknown = applied.filter(r => !knownSet.has(r.version));
 const unsafe = unknown.filter(r => r.previous_compatible !== true);
 if (unsafe.length === 0) return null;
 return `O banco tem migrations desta lista que esta versão da aplicação não conhece e que não foram declaradas compatíveis com a versão anterior: ${unsafe.map(r => r.version).join(', ')}. `
  + 'Reverter apenas a imagem não é seguro: siga o plano de recuperação (restaurar o backup anterior à atualização). Ver docs/cloud/OPERACAO.md.';
}
