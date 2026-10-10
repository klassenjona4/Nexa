import { magicLinkRequest } from '../../../shared/schemas/auth';
import { safeNextPath } from '../../../shared/schemas/common';

export { magicLinkRequest };

// Only same-origin paths are accepted as a return address after sign in.
export function safeNextPathOrDefault(value: string | null | undefined, fallback = '/projects'): string {
  const parsed = safeNextPath.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
