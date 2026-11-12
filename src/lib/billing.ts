import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

import type { Allowance, Entitlements, UsageKind } from '../../shared/plans';

export { allowanceLeft, nextProjectSource, type Allowance, type Entitlements, type UsageKind } from '../../shared/plans';


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


export function useEntitlements() {
  return useQuery({
    queryKey: ['entitlements'],
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

