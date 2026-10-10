import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireEnv } from './env.js';

// Invite codes and calendar tokens: token = HMAC(TOKEN_SECRET, purpose + nonce), 22 base64url
// characters (132 bits). The database stores the random nonce and sha256(token), so a database
// leak alone reveals no working token, while the server can show a member their link again.
export type TokenPurpose = 'invite' | 'calendar';

function secret(): Buffer {
  const raw = requireEnv('TOKEN_SECRET');
  const buf = Buffer.from(raw, 'base64');
  return buf.length >= 32 ? buf : Buffer.from(raw, 'utf8');
}

export function newNonce(): Buffer {
  return randomBytes(16);
}

export function deriveToken(purpose: TokenPurpose, nonce: Buffer): string {
  return createHmac('sha256', secret()).update(`${purpose}:`).update(nonce).digest('base64url').slice(0, 22);
}

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

// PostgREST represents bytea as a \x-prefixed hex string.
export function toBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`;
}

export function fromBytea(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ''), 'hex');
}

// Keyed hash for rate limit buckets, so no raw IP address or email is stored.
export function bucketKey(parts: string[]): string {
  return createHmac('sha256', secret()).update(`ratelimit:${parts.join('|')}`).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
