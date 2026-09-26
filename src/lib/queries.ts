import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type MyProject = {
  id: string;
  title: string;
  module_code: string;
  final_deadline: string | null;
  group_id: string;
  group_name: string;
  created_at: string;
};

export function useMyProjects(userId: string | undefined) {
  return useQuery({
    queryKey: ['projects', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyProject[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, module_code, final_deadline, group_id, created_at, groups(name)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        module_code: p.module_code,
        final_deadline: p.final_deadline,
        group_id: p.group_id,
        created_at: p.created_at,
        group_name: (p.groups as { name: string } | null)?.name ?? '',
      }));
    },
  });
}
