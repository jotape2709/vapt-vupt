import { z } from 'zod';
import { connectionString } from './pg-connection';

/**
 * Configuração do servidor, lida somente do ambiente. Qualquer item obrigatório ausente impede a
 * inicialização: não existe modo de autenticação falsa ou "demo" no servidor real.
 */
const bool = z.enum(['true', 'false']).default('false').transform(v => v === 'true');
const EnvSchema = z.object({
 DATABASE_URL: z.string().min(1),
 DATABASE_PASSWORD: z.string().optional(),
 APP_ORIGIN: z.string().url(),
 OIDC_ISSUER: z.string().url(),
 OIDC_CLIENT_ID: z.string().min(1),
 OIDC_CLIENT_SECRET: z.string().min(16),
 OIDC_ALLOW_HTTP: bool,
 OIDC_INTERNAL_ORIGIN: z.string().url().optional(),
 SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
 SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(7 * 24).default(12),
 WEB_DIST_DIR: z.string().optional(),
 TRUST_PROXY: bool,
 API_HOST: z.string().default('127.0.0.1'),
 PORT: z.coerce.number().int().min(1).max(65535).default(3001)
});

export type ServerConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
 const parsed = EnvSchema.safeParse(env);
 if (!parsed.success) {
  const keys = [...new Set(parsed.error.issues.map(i => String(i.path[0])))].join(', ');
  throw new Error('Configuração ausente ou inválida: ' + keys + '. Veja .env.example e docs/AUTH.md.');
 }
 const c = parsed.data;
 const origin = new URL(c.APP_ORIGIN);
 if (origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_ORIGIN deve ser apenas a origem, sem caminho (ex.: https://estoque.exemplo.com.br).');
 if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('APP_ORIGIN exige HTTPS fora de localhost.');
 return {
  databaseUrl: connectionString(c.DATABASE_URL, c.DATABASE_PASSWORD, { url: 'DATABASE_URL', password: 'DATABASE_PASSWORD' }),
  appOrigin: origin.origin,
  secureCookies: origin.protocol === 'https:',
  oidc: { issuer: c.OIDC_ISSUER, clientId: c.OIDC_CLIENT_ID, clientSecret: c.OIDC_CLIENT_SECRET, allowHttp: c.OIDC_ALLOW_HTTP, internalOrigin: c.OIDC_INTERNAL_ORIGIN },
  session: { idleMinutes: c.SESSION_IDLE_MINUTES, absoluteHours: c.SESSION_ABSOLUTE_HOURS },
  webDistDir: c.WEB_DIST_DIR,
  trustProxy: c.TRUST_PROXY,
  host: c.API_HOST,
  port: c.PORT
 };
}
