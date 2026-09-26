import { z } from 'zod';

export const deleteAccount = z.object({ confirm: z.literal('DELETE') }).strict();
