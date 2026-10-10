import { z } from 'zod';
import { email, safeNextPath } from './common.js';

export const magicLinkRequest = z.object({
  email,
  next: safeNextPath.optional(),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequest>;
