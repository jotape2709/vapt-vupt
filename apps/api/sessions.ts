import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database, Identity } from './db';

export type SessionPolicy = { idleMinutes: number; absoluteHours: number };
export type ActiveSession = Identity & {
 idHash: Buffer; csrfToken: string; idTokenHint: string | null;
 idleExpiresAt: Date; absoluteExpiresAt: Date; lastSeenAt: Date;
};
export type SessionLookup = { status: 'active'; session: ActiveSession } | { status: 'missing' | 'expired' | 'revoked' };

const hash = (secret: string) => createHash('sha256').update(secret, 'utf8').digest();
export const randomSecret = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string) {
 const x = Buffer.from(a), y = Buffer.from(b);
 return x.length === y.length && timingSafeEqual(x, y);
}

/** Atualiza last_seen/idle no máximo uma vez por minuto para não escrever a cada requisição. */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * Sessões de servidor. O cookie leva 256 bits aleatórios; o banco guarda apenas o SHA-256,
 * então um vazamento da tabela não permite assumir sessões. Expiração por inatividade e absoluta.
 */
export class SessionStore {
 constructor(private readonly db: Database, readonly policy: SessionPolicy) {}

 async create(identity: Identity, idTokenHint: string | null, now = new Date()) {
  const secret = randomSecret();
  const csrfToken = randomSecret();
  const idle = new Date(now.getTime() + this.policy.idleMinutes * 60_000);
  const absolute = new Date(now.getTime() + this.policy.absoluteHours * 3_600_000);
  await this.db.transaction(db => db.query(
   `INSERT INTO sessions(id_hash, issuer, subject, csrf_token, id_token_hint, created_at, last_seen_at, idle_expires_at, absolute_expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8)`,
   [hash(secret), identity.issuer, identity.subject, csrfToken, idTokenHint, now, idle < absolute ? idle : absolute, absolute]));
  return { secret, csrfToken, idleExpiresAt: idle < absolute ? idle : absolute, absoluteExpiresAt: absolute };
 }

 async lookup(secret: string | undefined, now = new Date()): Promise<SessionLookup> {
  if (!secret || secret.length > 100) return { status: 'missing' };
  const idHash = hash(secret);
  return this.db.transaction(async db => {
   const r = await db.query(
    `SELECT s.issuer, s.subject, s.csrf_token, s.id_token_hint, s.idle_expires_at, s.absolute_expires_at, s.last_seen_at, s.revoked_at
     FROM sessions s WHERE s.id_hash=$1`, [idHash]);
   const row = r.rows[0];
   if (!row) return { status: 'missing' } as const;
   if (row.revoked_at) return { status: 'revoked' } as const;
   if (now >= row.idle_expires_at || now >= row.absolute_expires_at) {
    await db.query("UPDATE sessions SET revoked_at=$2, revoked_reason='expired', id_token_hint=NULL WHERE id_hash=$1 AND revoked_at IS NULL", [idHash, now]);
    return { status: 'expired' } as const;
   }
   let { idle_expires_at: idleExpiresAt, last_seen_at: lastSeenAt } = row as { idle_expires_at: Date; last_seen_at: Date };
   if (now.getTime() - lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
    const nextIdle = new Date(Math.min(now.getTime() + this.policy.idleMinutes * 60_000, row.absolute_expires_at.getTime()));
    await db.query('UPDATE sessions SET last_seen_at=$2, idle_expires_at=$3 WHERE id_hash=$1', [idHash, now, nextIdle]);
    idleExpiresAt = nextIdle; lastSeenAt = now;
   }
   // Nome exibido vem do registro do usuário, lido com a identidade da própria sessão.
   await db.query("SELECT set_config('app.issuer', $1, true), set_config('app.subject', $2, true)", [row.issuer, row.subject]);
   const user = await db.query<{ display_name: string | null }>('SELECT display_name FROM users WHERE issuer=$1 AND subject=$2', [row.issuer, row.subject]);
   return {
    status: 'active',
    session: {
     idHash, issuer: row.issuer, subject: row.subject, name: user.rows[0]?.display_name ?? null,
     csrfToken: row.csrf_token, idTokenHint: row.id_token_hint,
     idleExpiresAt, absoluteExpiresAt: row.absolute_expires_at, lastSeenAt
    }
   } as const;
  });
 }

 async revoke(idHash: Buffer, reason: 'logout' | 'rotated' | 'admin', now = new Date()) {
  await this.db.transaction(db => db.query('UPDATE sessions SET revoked_at=$2, revoked_reason=$3, id_token_hint=NULL WHERE id_hash=$1 AND revoked_at IS NULL', [idHash, now, reason]));
 }

 async revokeSecret(secret: string | undefined, reason: 'logout' | 'rotated') {
  if (secret && secret.length <= 100) await this.revoke(hash(secret), reason);
 }

 /** Limpeza oportunista de sessões encerradas há mais de 7 dias e de transações OIDC vencidas. */
 async purge(now = new Date()) {
  await this.db.transaction(async db => {
   await db.query("DELETE FROM sessions WHERE absolute_expires_at < $1::timestamptz - interval '7 days'", [now]);
   await db.query('DELETE FROM auth_transactions WHERE expires_at < $1', [now]);
  });
 }

 /* ---------- Transações do login OIDC (state, nonce e PKCE ficam no servidor) ---------- */

 async beginLogin(values: { state: string; nonce: string; codeVerifier: string; returnTo: string }, now = new Date()) {
  const secret = randomSecret();
  await this.db.transaction(db => db.query(
   'INSERT INTO auth_transactions(id_hash, state, nonce, code_verifier, return_to, created_at, expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
   [hash(secret), values.state, values.nonce, values.codeVerifier, values.returnTo, now, new Date(now.getTime() + 10 * 60_000)]));
  return secret;
 }

 /** Uso único: a linha é apagada ao ser lida. */
 async consumeLogin(secret: string | undefined, now = new Date()) {
  if (!secret || secret.length > 100) return null;
  return this.db.transaction(async db => {
   const r = await db.query<{ state: string; nonce: string; code_verifier: string; return_to: string; expires_at: Date }>(
    'DELETE FROM auth_transactions WHERE id_hash=$1 RETURNING state, nonce, code_verifier, return_to, expires_at', [hash(secret)]);
   const row = r.rows[0];
   if (!row || row.expires_at <= now) return null;
   return { state: row.state, nonce: row.nonce, codeVerifier: row.code_verifier, returnTo: row.return_to };
  });
 }
}
