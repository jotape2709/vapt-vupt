import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import {
 MovementCreateSchema, ProductCreateSchema, SettingsUpdateSchema, UserPreferencesSchema, logoLimits, type Session
} from '../../packages/domain/contracts';
import type { Identity } from './db';
import { ApiError } from './errors';
import { pkce, type OidcProvider } from './oidc';
import type { Operations } from './operations';
import { safeEqual, type ActiveSession, type SessionStore } from './sessions';

export type AppOptions = {
 appOrigin: string;
 secureCookies: boolean;
 webDistDir?: string;
 trustProxy?: boolean;
 /** Desliga logs em testes. */
 logger?: boolean;
 /** Requisições por minuto por IP (padrão 300). */
 rateLimitMax?: number;
};

type Deps = { ops: Operations; sessions: SessionStore; oidc: OidcProvider };

declare module 'fastify' {
 interface FastifyRequest { vvSession?: ActiveSession }
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const orgParams = z.object({ orgId: z.string().uuid() }).strict();
const unitParams = z.object({ orgId: z.string().uuid(), unitId: z.string().uuid() }).strict();

/** Só caminhos internos da aplicação real: impede redirecionamento aberto depois do login. */
export function safeReturnTo(value: unknown) {
 if (typeof value !== 'string' || value.length > 200) return '/app';
 if (!/^\/app(?:[/?#][^\\\s]*)?$/.test(value) || value.startsWith('//')) return '/app';
 return value;
}

const identityOf = (s: ActiveSession): Identity => ({ issuer: s.issuer, subject: s.subject, name: s.name });

/**
 * BFF no mesmo domínio da interface. O navegador nunca recebe tokens do provedor: recebe um
 * cookie de sessão HttpOnly e um token CSRF exigido em toda operação que altera dados.
 */
export function buildApp(deps: Deps, options: AppOptions) {
 const app = Fastify({
  bodyLimit: 64 * 1024,
  trustProxy: options.trustProxy ?? false,
  logger: options.logger === false ? false : { redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]'] }
 });
 const sessionCookie = options.secureCookies ? '__Host-vv_session' : 'vv_session';
 const loginCookie = options.secureCookies ? '__Host-vv_login' : 'vv_login';
 const cookieBase = { httpOnly: true, secure: options.secureCookies, sameSite: 'lax' as const, path: '/' };

 app.register(cookie);
 app.register(helmet, {
  contentSecurityPolicy: {
   useDefaults: false,
   directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'"], fontSrc: ["'self'"],
    objectSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"],
    ...(options.secureCookies ? { upgradeInsecureRequests: [] } : {})
   }
  },
  strictTransportSecurity: options.secureCookies
 });
 app.register(rateLimit, { max: options.rateLimitMax ?? 300, timeWindow: '1 minute' });

 app.get('/health', async () => ({ status: 'ok', scope: 'process-only' }));

 /* ---------- Login, retorno e logout (OIDC Authorization Code + PKCE) ---------- */

 app.register(async auth => {
  auth.get('/auth/login', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
   const returnTo = safeReturnTo((req.query as Record<string, unknown>).returnTo);
   const state = pkce.state(), nonce = pkce.nonce(), codeVerifier = pkce.verifier();
   const secret = await deps.sessions.beginLogin({ state, nonce, codeVerifier, returnTo });
   reply.setCookie(loginCookie, secret, { ...cookieBase, maxAge: 600 });
   reply.header('Cache-Control', 'no-store');
   return reply.redirect(deps.oidc.authorizationUrl({ redirectUri: options.appOrigin + '/auth/callback', state, nonce, codeChallenge: await pkce.challenge(codeVerifier) }).href, 302);
  });

  auth.get('/auth/callback', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
   reply.header('Cache-Control', 'no-store');
   const tx = await deps.sessions.consumeLogin(req.cookies[loginCookie]);
   reply.clearCookie(loginCookie, cookieBase);
   const query = req.query as Record<string, unknown>;
   if (!tx) return reply.redirect('/app?auth_error=expired', 302);
   if (typeof query.error === 'string') return reply.redirect('/app?auth_error=denied', 302);
   try {
    const { claims, idToken } = await deps.oidc.completeLogin(new URL(req.url, options.appOrigin), tx);
    const identity: Identity = { issuer: claims.issuer, subject: claims.subject, name: claims.name };
    await deps.ops.upsertUser(identity, claims.email);
    // Rotação: uma sessão anterior neste navegador é encerrada antes de emitir a nova.
    await deps.sessions.revokeSecret(req.cookies[sessionCookie], 'rotated');
    const created = await deps.sessions.create(identity, idToken);
    reply.setCookie(sessionCookie, created.secret, { ...cookieBase, maxAge: deps.sessions.policy.absoluteHours * 3600 });
    void deps.sessions.purge().catch(err => req.log.warn({ err }, 'Limpeza de sessões falhou'));
    return reply.redirect(tx.returnTo, 302);
   } catch (err) {
    req.log.warn({ err }, 'Falha ao concluir login OIDC');
    return reply.redirect('/app?auth_error=failed', 302);
   }
  });

  auth.post('/auth/logout', async (req, reply) => {
   reply.header('Cache-Control', 'no-store');
   const lookup = await deps.sessions.lookup(req.cookies[sessionCookie]);
   const fallback = options.appOrigin + '/app?signed_out=1';
   if (lookup.status !== 'active') {
    reply.clearCookie(sessionCookie, cookieBase);
    return { redirectTo: fallback };
   }
   checkCsrf(req, lookup.session);
   await deps.sessions.revoke(lookup.session.idHash, 'logout');
   reply.clearCookie(sessionCookie, cookieBase);
   const endSession = deps.oidc.endSessionUrl({ idTokenHint: lookup.session.idTokenHint, postLogoutRedirectUri: fallback });
   return { redirectTo: endSession?.href ?? fallback };
  });
 });

 /** Token sincronizador + conferência de origem para toda operação que altera dados. */
 function checkCsrf(req: FastifyRequest, session: ActiveSession) {
  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if (origin !== undefined && origin !== options.appOrigin) throw new ApiError(403, 'csrf_rejected', 'Origem da requisição não permitida.');
  if (origin === undefined && site !== undefined && site !== 'same-origin') throw new ApiError(403, 'csrf_rejected', 'Origem da requisição não permitida.');
  const token = req.headers['x-csrf-token'];
  if (typeof token !== 'string' || !safeEqual(token, session.csrfToken)) throw new ApiError(403, 'csrf_rejected', 'Token de segurança ausente ou inválido. Recarregue a página.');
 }

 /* ---------- API autenticada por sessão ---------- */

 app.register(async api => {
  api.addContentTypeParser([...logoLimits.types], { parseAs: 'buffer', bodyLimit: logoLimits.maxBytes }, (_req, body, done) => done(null, body));

  api.addHook('onRequest', async (req, reply) => {
   reply.header('Cache-Control', 'no-store');
   const lookup = await deps.sessions.lookup(req.cookies[sessionCookie]);
   if (lookup.status !== 'active') {
    if (lookup.status !== 'missing') reply.clearCookie(sessionCookie, cookieBase);
    throw lookup.status === 'missing'
     ? new ApiError(401, 'unauthenticated', 'Entre para continuar.')
     : new ApiError(401, 'session_expired', 'Sua sessão terminou. Entre novamente para continuar.');
   }
   req.vvSession = lookup.session;
   if (UNSAFE.has(req.method)) checkCsrf(req, lookup.session);
  });
  const who = (req: FastifyRequest) => identityOf(req.vvSession!);

  api.get('/session', async (req): Promise<Session> => {
   const s = req.vvSession!;
   return {
    authenticated: true,
    user: { name: s.name, email: null, subject: s.subject, issuer: s.issuer },
    csrfToken: s.csrfToken, idleExpiresAt: s.idleExpiresAt.toISOString(), absoluteExpiresAt: s.absoluteExpiresAt.toISOString()
   };
  });
  api.get('/me', async req => deps.ops.me(who(req)));
  api.put('/me/preferences', async req => deps.ops.savePreferences(who(req), UserPreferencesSchema.parse(req.body)));

  api.get('/orgs/:orgId/context', async req => deps.ops.context(who(req), orgParams.parse(req.params).orgId));
  api.put('/orgs/:orgId/settings', async req => {
   const body = SettingsUpdateSchema.parse(req.body);
   return deps.ops.updateSettings(who(req), orgParams.parse(req.params).orgId, body.expectedVersion, body.settings);
  });
  api.post('/orgs/:orgId/logo', async (req, reply) => {
   if (!Buffer.isBuffer(req.body)) throw new ApiError(415, 'invalid_image', 'Use PNG, JPG ou WebP.');
   const result = await deps.ops.uploadLogo(who(req), orgParams.parse(req.params).orgId, req.body, req.headers['content-type']);
   return reply.code(201).send(result);
  });
  api.get('/orgs/:orgId/assets/:assetId', async (req, reply: FastifyReply) => {
   const params = z.object({ orgId: z.string().uuid(), assetId: z.string().uuid() }).strict().parse(req.params);
   const asset = await deps.ops.asset(who(req), params.orgId, params.assetId);
   return reply
    .header('Content-Type', asset.content_type)
    .header('Cache-Control', 'private, no-cache')
    .header('ETag', '"' + asset.sha256 + '"')
    .header('Content-Security-Policy', "default-src 'none'; sandbox")
    .header('Content-Disposition', 'inline')
    .send(asset.content);
  });

  api.get('/orgs/:orgId/units/:unitId/stock', async req => {
   const p = unitParams.parse(req.params);
   return deps.ops.stock(who(req), p.orgId, p.unitId, req.query as Record<string, string>);
  });
  api.post('/orgs/:orgId/products', async (req, reply) => {
   const product = await deps.ops.createProduct(who(req), orgParams.parse(req.params).orgId, ProductCreateSchema.parse(req.body));
   return reply.code(201).send(product);
  });
  api.post('/orgs/:orgId/units/:unitId/movements', async req => {
   const p = unitParams.parse(req.params);
   return deps.ops.move(who(req), p.orgId, p.unitId, MovementCreateSchema.parse(req.body));
  });
  api.get('/orgs/:orgId/units/:unitId/movements', async req => {
   const p = unitParams.parse(req.params);
   return deps.ops.movements(who(req), p.orgId, p.unitId, req.query as Record<string, string>);
  });
  api.get('/orgs/:orgId/movements/:eventId', async req => {
   const p = z.object({ orgId: z.string().uuid(), eventId: z.string().uuid() }).strict().parse(req.params);
   return deps.ops.movement(who(req), p.orgId, p.eventId);
  });
 }, { prefix: '/api' });

 /* ---------- Interface compilada no mesmo domínio (opcional) ---------- */

 if (options.webDistDir) {
  app.register(fastifyStatic, { root: options.webDistDir, index: ['index.html'], wildcard: false });
  app.setNotFoundHandler((req, reply) => {
   const path = req.url.split('?')[0];
   if (req.method === 'GET' && !path.startsWith('/api/') && !path.startsWith('/auth/') && !/\.[a-z0-9]+$/i.test(path)) return reply.sendFile('index.html');
   return reply.code(404).send({ error: 'not_found', message: 'Recurso não encontrado.' });
  });
 }

 app.setErrorHandler((error, req, reply) => {
  if (error instanceof ApiError) return reply.code(error.statusCode).send(error.body());
  if (error instanceof z.ZodError) {
   const fields: Record<string, string> = {};
   for (const issue of error.issues) { const key = issue.path.join('.'); if (key && !fields[key]) fields[key] = issue.message; }
   return reply.code(400).send({ error: 'validation', message: 'Confira os campos destacados.', fields });
  }
  const statusCode = (error as { statusCode?: number }).statusCode;
  const code = (error as { code?: string }).code;
  if (code === '23505') return reply.code(409).send({ error: 'duplicate_sku', message: 'Registro já existente nesta empresa.' });
  if (statusCode === 413 && req.url.endsWith('/logo')) return reply.code(413).send({ error: 'invalid_image', message: `Use uma imagem de até ${logoLimits.maxBytes / 1024} KB.` });
  if (statusCode === 415) return reply.code(415).send({ error: req.url.endsWith('/logo') ? 'invalid_image' : 'validation', message: req.url.endsWith('/logo') ? 'Use PNG, JPG ou WebP.' : 'Tipo de conteúdo não aceito.' });
  if (statusCode === 429) return reply.code(429).send({ error: 'rate_limited', message: 'Muitas solicitações. Aguarde um minuto e tente novamente.' });
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) return reply.code(statusCode).send({ error: 'validation', message: 'Solicitação rejeitada.' });
  req.log.error({ err: error }, 'Falha na operação');
  return reply.code(500).send({ error: 'server_error', message: 'Não foi possível concluir a operação.' });
 });

 return app;
}
