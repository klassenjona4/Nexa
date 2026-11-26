// Sign in links to MTU addresses are currently blocked by MTU's email filter.
const BLOCKED_DOMAINS = ['mtu.ie', 'mymtu.ie'];

export function isMtuAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return BLOCKED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
