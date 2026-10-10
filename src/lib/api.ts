import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly fields?: string,
  ) {
    super(code);
  }
}

// Calls the Nexa API with the current access token. The server never trusts ids, roles or counts
// from this client: it checks everything against the database.
export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth !== false) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const type = res.headers.get('content-type') ?? '';
  const payload = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const p = payload as { error?: string; fields?: string } | null;
    throw new ApiError(res.status, p?.error ?? 'server_error', p?.fields);
  }
  return payload as T;
}

// Normalises Supabase (PostgREST) errors raised by RLS or database functions.
export function dbErrorCode(error: { code?: string; message?: string } | null): string {
  if (!error) return 'server_error';
  if (error.code === 'P0002' || error.code === 'PGRST116') return 'not_found';
  if (error.code === 'P0001' && error.message && /^[a-z_]{3,40}$/.test(error.message)) return error.message;
  if (error.code === '42501') return 'forbidden';
  if (error.code === '23514' || error.code === '22P02') return 'invalid_input';
  return 'server_error';
}

export function codeOf(err: unknown): string {
  if (err instanceof ApiError) return err.code;
  if (err && typeof err === 'object' && 'code' in err) return dbErrorCode(err as { code?: string; message?: string });
  return 'server_error';
}
