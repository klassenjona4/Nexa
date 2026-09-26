import { describe, expect, it } from 'vitest';
import { magicLinkRequest } from './auth.js';

describe('magic link request', () => {
  it('normalises the email address', () => {
    expect(magicLinkRequest.parse({ email: ' Aoife.Byrne@MyMTU.ie ' }).email).toBe('aoife.byrne@mymtu.ie');
  });

  it('accepts only same-origin return paths', () => {
    expect(magicLinkRequest.safeParse({ email: 'a@b.ie', next: '/join/abc' }).success).toBe(true);
    expect(magicLinkRequest.safeParse({ email: 'a@b.ie', next: '//evil.example' }).success).toBe(false);
    expect(magicLinkRequest.safeParse({ email: 'a@b.ie', next: 'https://evil.example' }).success).toBe(false);
    expect(magicLinkRequest.safeParse({ email: 'a@b.ie', next: '/\\evil.example' }).success).toBe(false);
  });

  it('rejects unknown input', () => {
    expect(magicLinkRequest.safeParse({ email: 'not an email' }).success).toBe(false);
  });
});
