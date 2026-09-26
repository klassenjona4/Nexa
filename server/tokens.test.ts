import { beforeAll, describe, expect, it } from 'vitest';
import { deriveToken, fromBytea, hashToken, newNonce, toBytea, TOKEN_RE } from './tokens.js';
import { routeTemplate } from './logger.js';

beforeAll(() => {
  process.env.TOKEN_SECRET = Buffer.alloc(48, 7).toString('base64');
});

describe('tokens', () => {
  it('derives 22 character url safe tokens with at least 128 bits', () => {
    const token = deriveToken('invite', newNonce());
    expect(token).toMatch(TOKEN_RE);
    expect(token.length * 6).toBeGreaterThanOrEqual(128);
  });

  it('is deterministic per nonce and separated by purpose', () => {
    const nonce = newNonce();
    expect(deriveToken('invite', nonce)).toBe(deriveToken('invite', nonce));
    expect(deriveToken('calendar', nonce)).not.toBe(deriveToken('invite', nonce));
    expect(deriveToken('invite', newNonce())).not.toBe(deriveToken('invite', nonce));
  });

  it('stores only a sha256 hash', () => {
    expect(hashToken('abc').length).toBe(32);
  });

  it('round trips bytea hex', () => {
    const buf = newNonce();
    expect(fromBytea(toBytea(buf)).equals(buf)).toBe(true);
  });
});

describe('log route templates', () => {
  it('removes ids and tokens from paths', () => {
    expect(routeTemplate('/api/projects/0b4f0c7e-8a0e-4b9e-9d5c-6c1f2a3b4c5d/invites')).toBe('/api/projects/:id/invites');
    expect(routeTemplate('/api/invites/AbCdEfGhIjKlMnOpQrStUv/preview')).toBe('/api/invites/:code/preview');
    expect(routeTemplate('/cal/AbCdEfGhIjKlMnOpQrStUv.ics')).toBe('/cal/:token');
  });
});
