import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env.js';
import { HttpError, unauthorised } from './http.js';

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

let admin: SupabaseClient | null = null;

// Service role client. Bypasses RLS: use only for server-only tables and flows that are
// authorised explicitly in the route before the call.
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), clientOptions);
  }
  return admin;
}

// Client that acts as the signed-in user, so every query is subject to RLS.
export function userClient(accessToken: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type AuthUser = { id: string; email: string };

export async function verifyAccessToken(token: string): Promise<AuthUser> {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 4096) {
    throw unauthorised();
  }
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user || !data.user.email) throw unauthorised();
  return { id: data.user.id, email: data.user.email };
}

// Maps Postgres errors raised by our functions (P0001 with a code as message) to HTTP errors.
export function dbError(error: { code?: string; message?: string } | null): HttpError {
  if (!error) return new HttpError(500, 'server_error');
  if (error.code === 'P0002') return new HttpError(404, 'not_found');
  if (error.code === 'P0001' && error.message && /^[a-z_]{3,40}$/.test(error.message)) {
    return new HttpError(409, error.message);
  }
  if (error.code === '42501') return new HttpError(403, 'forbidden');
  if (error.code === '23514' || error.code === '22P02') return new HttpError(400, 'invalid_input');
  return new HttpError(500, 'server_error');
}
