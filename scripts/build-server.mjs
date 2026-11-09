// Compila a API para JavaScript (produção). Dependências do package.json ficam de fora do pacote e
// vêm de `npm ci --omit=dev`; o código do repositório (apps/api, packages/domain) é embutido.
// Saída em dist-server/api/: migrate.js resolve ../../db/ a partir dali, igual ao código-fonte.
import { build } from 'esbuild';

await build({
 entryPoints: ['apps/api/server.ts', 'apps/api/migrate.ts', 'apps/api/admin-cli.ts'],
 outdir: 'dist-server/api',
 bundle: true,
 packages: 'external',
 platform: 'node',
 format: 'esm',
 target: 'node22',
 sourcemap: true,
 legalComments: 'none',
 logLevel: 'info'
});
