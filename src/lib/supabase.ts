import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../shared/database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set.');
}

// The session is kept in localStorage under one key. This is strictly necessary storage for
// signing in, so no consent banner is needed. See the privacy policy.
export const supabase = createClient<Database>(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'nexa-auth',
  },
});
