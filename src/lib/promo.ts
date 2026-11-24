import { useQuery } from '@tanstack/react-query';
import type { RedeemPromoResponse } from '../../shared/schemas/promo';
import { api } from './api';
import { supabase } from './supabase';

export { PROMO_DEFAULT_DAYS } from '../../shared/promo';
export type { RedeemPromoResponse };

// Redeeming is decided entirely on the server. emailUpdates is the separate, optional choice
// about occasional emails; it never affects the code.
export function redeemCode(code: string, emailUpdates?: boolean): Promise<RedeemPromoResponse> {
  return api<RedeemPromoResponse>('/api/promo/redeem', {
    body: { code, ...(emailUpdates === undefined ? {} : { email_updates: emailUpdates }) },
  });
}

export function saveEmailUpdates(emailUpdates: boolean): Promise<{ ok: true }> {
  return api('/api/account/email-updates', { method: 'PUT', body: { email_updates: emailUpdates } });
}

// The user's own latest choice, or null when they have never made one.
export function useEmailUpdates(userId: string | undefined) {
  return useQuery({
    queryKey: ['email-updates', userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ email_updates: boolean; decided_at: string } | null> => {
      const { data, error } = await supabase.from('marketing_consents').select('email_updates, decided_at').maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Premium is active while premium_until is in the future. Shown only; enforced in the database.
export function premiumActive(premiumUntil: string | null | undefined, now = Date.now()): boolean {
  return !!premiumUntil && new Date(premiumUntil).getTime() > now;
}
