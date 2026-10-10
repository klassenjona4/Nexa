import { z } from 'zod';
import { requiredText } from './common.js';

export const profileUpdate = z.object({ full_name: requiredText(100) }).strict();
export type ProfileUpdate = z.infer<typeof profileUpdate>;
