import { z } from 'zod';
import { DATE_RE, TIME_RE } from '../dates.js';

export const uuid = z.uuid();
export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const irishDate = z.string().trim().regex(DATE_RE, 'Enter the date in the format DD/MM/YYYY.');
export const irishTime = z.string().trim().regex(TIME_RE, 'Enter the time in the format HH:MM, 24 hour.');
export const isoDateTime = z.iso.datetime({ offset: true });

// A same-origin path to return to after sign in. Rejects protocol-relative and absolute URLs.
export const safeNextPath = z
  .string()
  .max(200)
  .regex(/^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/);

export const text = (max: number) => z.string().trim().max(max);
export const requiredText = (max: number) => z.string().trim().min(1).max(max);
