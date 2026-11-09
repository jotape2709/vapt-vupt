import { crc32, deflateSync } from 'node:zlib';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

export const APP_ORIGIN = 'http://localhost:5173';

export type TestClient = {
 cookie: string; csrf: string;
 get: (url: string) => Promise<LightMyRequestResponse>;
 send: (method: 'POST' | 'PUT', url: string, payload?: unknown, headers?: Record<string, string>) => Promise<LightMyRequestResponse>;
};

/** Login completo pelas rotas /auth (com a fixture OIDC), devolvendo um cliente com cookie e CSRF. */
export async function login(app: FastifyInstance, code: string): Promise<TestClient> {
 const start = await app.inject({ url: '/auth/login?returnTo=/app' });
 if (start.statusCode !== 302) throw new Error('login não redirecionou: ' + start.statusCode);
 const loginCookie = start.cookies.find(c => c.name === 'vv_login')!.value;
 const state = new URL(String(start.headers.location)).searchParams.get('state')!;
 const callback = await app.inject({ url: `/auth/callback?code=${code}&state=${state}`, cookies: { vv_login: loginCookie } });
 const session = callback.cookies.find(c => c.name === 'vv_session');
 if (!session) throw new Error('callback sem sessão: ' + callback.headers.location);
 const info = await app.inject({ url: '/api/session', cookies: { vv_session: session.value } });
 return clientFor(app, session.value, info.json().csrfToken);
}

export function clientFor(app: FastifyInstance, cookie: string, csrf: string): TestClient {
 return {
  cookie, csrf,
  get: url => app.inject({ url, cookies: { vv_session: cookie } }),
  send: (method, url, payload, headers = {}) => app.inject({
   method, url, cookies: { vv_session: cookie },
   headers: { origin: APP_ORIGIN, 'x-csrf-token': csrf, ...headers },
   ...(Buffer.isBuffer(payload) ? { payload } : payload === undefined ? {} : { payload: payload as object })
  })
 };
}

/** PNG RGB válido gerado em memória, para testar o pipeline de logotipo. */
export function pngImage(width: number, height: number) {
 const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
 };
 const ihdr = Buffer.alloc(13);
 ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
 const rows = Buffer.alloc((width * 3 + 1) * height, 0x40);
 for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
 return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
