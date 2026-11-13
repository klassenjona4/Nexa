import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { supabase } from './supabase';

import { type Allowance, type Entitlements, PAYMENTS_AVAILABLE, type UsageKind } from '../../shared/plans';

export { PAYMENTS_AVAILABLE, allowanceLeft, nextProjectSource, type Allowance, type Entitlements, type UsageKind } from '../../shared/plans';


// The allowance is shown to members but counted and enforced only in the database.
export function useAllowance(projectId: string, kind: UsageKind) {
  return useQuery({
    queryKey: ['usage', projectId, kind],
    queryFn: async (): Promise<Allowance> => {
      const { data, error } = await supabase.rpc('project_allowance', { p_project: projectId });
      if (error) throw error;
      const row = data?.find((r) => r.kind === kind);
      return {
        used: row?.used ?? 0,
        max: row?.max ?? 0,
        unlimited: row?.unlimited ?? false,
        plan: row?.plan ?? 'free',
        subscriptionActive: row?.subscription_active ?? null,
      };
    },
  });
}


export function useEntitlements(enabled = true) {
  return useQuery({
    queryKey: ['entitlements'],
    enabled,
    queryFn: async (): Promise<Entitlements> => {
      const { data, error } = await supabase.rpc('my_entitlements');
      if (error) throw error;
      const row = data?.[0];
      return {
        subscriptionActive: row?.subscription_active ?? false,
        freeProjectAvailable: row?.free_project_available ?? false,
        projectCredits: row?.project_credits ?? 0,
      };
    },
  });
}


// Sends the browser to Stripe Checkout. Prices and limits are decided on the server.
export async function startCheckout(kind: 'project' | 'subscription', projectId?: string): Promise<void> {
  if (!PAYMENTS_AVAILABLE) throw new ApiError(403, 'payments_unavailable');
  const { url } = await api<{ url: string }>('/api/billing/checkout', {
    body: { kind, start_now: true, ...(projectId ? { project_id: projectId } : {}) },
  });
  window.location.assign(url);
}

export async function openBillingPortal(): Promise<void> {
  if (!PAYMENTS_AVAILABLE) throw new ApiError(403, 'payments_unavailable');
  const { url } = await api<{ url: string }>('/api/billing/portal', { method: 'POST' });
  window.location.assign(url);
}

export type BillingAccount = {
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  project_credits: number;
  free_project_used: boolean;
  has_customer: boolean;
};

export function useBillingAccount(userId: string | undefined) {
  return useQuery({
    queryKey: ['billing-account', userId],
    enabled: !!userId,
    queryFn: async (): Promise<BillingAccount | null> => {
      const { data, error } = await supabase
        .from('billing_accounts')
        .select('subscription_status, current_period_end, cancel_at_period_end, project_credits, free_project_used, stripe_customer_id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { stripe_customer_id, ...rest } = data;
      return { ...rest, has_customer: !!stripe_customer_id };
    },
  });
}
