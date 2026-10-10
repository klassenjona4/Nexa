import type { Context } from 'hono';
import type { z } from 'zod';
import { HttpError } from './http.js';

export async function readJson(c: Context): Promise<unknown> {
  const type = c.req.header('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type');
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Only field paths are returned, never the submitted values.
    const fields = [...new Set(result.error.issues.map((i) => i.path.join('.')).filter(Boolean))].slice(0, 10);
    throw new HttpError(400, 'invalid_input', fields.join(','));
  }
  return result.data;
}
