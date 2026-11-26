import { describe, expect, it } from 'vitest';
import { isMtuAddress } from './emailDomains.js';

describe('isMtuAddress', () => {
  it('matches MTU staff and student addresses, including subdomains', () => {
    expect(isMtuAddress('r00123456@mymtu.ie')).toBe(true);
    expect(isMtuAddress('Someone@MTU.ie ')).toBe(true);
    expect(isMtuAddress('a@student.mtu.ie')).toBe(true);
  });
  it('does not match other addresses', () => {
    expect(isMtuAddress('aoife@gmail.com')).toBe(false);
    expect(isMtuAddress('a@notmtu.ie')).toBe(false);
    expect(isMtuAddress('not an email')).toBe(false);
  });
});
