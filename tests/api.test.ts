import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logUrl, safeReturnTo } from '../apps/api/app';
import { loadConfig } from '../apps/api/config';
import { inspectImage } from '../apps/api/images';
import { pngImage } from './support/client';

const env = {
 DATABASE_URL: 'postgresql://runtime@127.0.0.1/vv', APP_ORIGIN: 'http://localhost:5173',
 OIDC_ISSUER: 'http://localhost:8080/realms/vapt', OIDC_CLIENT_ID: 'vapt-vupt-web', OIDC_CLIENT_SECRET: 'x'.repeat(32)
};

test('servidor não inicia sem configuração de identidade: não existe autenticação falsa', () => {
 for (const key of Object.keys(env)) {
  const partial: Record<string, string> = { ...env }; delete partial[key];
  assert.throws(() => loadConfig(partial), new RegExp(key));
 }
 assert.throws(() => loadConfig({ ...env, APP_ORIGIN: 'http://loja.exemplo.com' }), /HTTPS/);
 assert.throws(() => loadConfig({ ...env, APP_ORIGIN: 'https://loja.exemplo.com/app' }), /origem/);
 const config = loadConfig({ ...env, APP_ORIGIN: 'https://loja.exemplo.com' });
 assert.equal(config.secureCookies, true);
 assert.equal(loadConfig(env).secureCookies, false);
});

test('retorno após login aceita só caminhos internos da aplicação real', () => {
 assert.equal(safeReturnTo('/app'), '/app');
 assert.equal(safeReturnTo('/app?org=1'), '/app?org=1');
 for (const bad of ['//evil.example', 'https://evil.example', '/app\\evil', '/demo', '/apparent', '', 42, '/app/' + 'x'.repeat(300)]) assert.equal(safeReturnTo(bad), '/app');
});

test('logotipo: valida conteúdo, tipo declarado, dimensões e tamanho', () => {
 assert.deepEqual(inspectImage(pngImage(48, 24), 'image/png'), { contentType: 'image/png', width: 48, height: 24 });
 assert.throws(() => inspectImage(pngImage(48, 24), 'image/jpeg'), /não corresponde/);
 assert.throws(() => inspectImage(pngImage(8, 8), 'image/png'), /entre 16/);
 assert.throws(() => inspectImage(pngImage(1025, 20), 'image/png'), /entre 16/);
 assert.throws(() => inspectImage(Buffer.from('<svg/>'), 'image/png'), /PNG, JPG ou WebP/);
 assert.throws(() => inspectImage(pngImage(48, 24).subarray(0, 60), 'image/png'), /incompleto/);
 assert.throws(() => inspectImage(Buffer.concat([pngImage(48, 24), Buffer.from('<script>')]), 'image/png'), /incompleto|após/);
 const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x40, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
 assert.deepEqual(inspectImage(jpeg, 'image/jpeg'), { contentType: 'image/jpeg', width: 64, height: 32 });
 const vp8l = Buffer.alloc(30); vp8l.write('RIFF', 0, 'latin1'); vp8l.writeUInt32LE(22, 4); vp8l.write('WEBPVP8L', 8, 'latin1'); vp8l[20] = 0x2f;
 vp8l[21] = 99; vp8l[22] = 0; vp8l[23] = 0x0c; vp8l[24] = 0; // largura 100, altura 49
 assert.deepEqual(inspectImage(vp8l, 'image/webp'), { contentType: 'image/webp', width: 100, height: 49 });
});

test('logs não guardam code e state do retorno do provedor', () => {
 assert.equal(logUrl('/auth/callback?code=segredo&state=abc'), '/auth/callback');
 assert.equal(logUrl('/api/orgs/x/units/y/stock?q=arroz'), '/api/orgs/x/units/y/stock?q=arroz');
});
