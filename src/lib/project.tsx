import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext } from 'react';
import type { Json } from '../../shared/database.types';
import { supabase } from './supabase';

export type Member = { user_id: string; full_name: string; email: string; role: 'owner' | 'member'; joined_at: string };
export type Brief = {
  deliverables: { name: string; detail: string }[];
  deadlines: { item: string; due_at: string | null }[];
  criteria: { name: string; weight: number | null }[];
};
export type Project = {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  module_code: string;
  final_deadline: string | null;
  plan: string;
  brief: Brief | null;
  last_activity_at: string;
  deletion_warned_at: string | null;
};

type ProjectState = { project: Project; members: Member[]; role: 'owner' | 'member'; isOwner: boolean; memberName: (id: string | null | undefined) => string };

const ProjectContext = createContext<ProjectState | null>(null);

export function parseBrief(value: Json | null): Brief | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    deliverables: Array.isArray(v.deliverables) ? (v.deliverables as Brief['deliverables']) : [],
    deadlines: Array.isArray(v.deadlines) ? (v.deadlines as Brief['deadlines']) : [],
    criteria: Array.isArray(v.criteria) ? (v.criteria as Brief['criteria']) : [],
  };
}

export function useProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, group_id, title, module_code, final_deadline, plan, brief, last_activity_at, deletion_warned_at, groups(name)')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      const { data: members, error: mErr } = await supabase.rpc('group_member_list', { p_group: data.group_id });
      if (mErr) throw mErr;
      const project: Project = {
        id: data.id,
        group_id: data.group_id,
        group_name: data.groups?.name ?? '',
        title: data.title,
        module_code: data.module_code,
        final_deadline: data.final_deadline,
        plan: data.plan,
        brief: parseBrief(data.brief),
        last_activity_at: data.last_activity_at,
        deletion_warned_at: data.deletion_warned_at,
      };
      return { project, members: (members ?? []) as Member[] };
    },
  });
}

export function ProjectProvider({ userId, project, members, children }: { userId: string; project: Project; members: Member[]; children: ReactNode }) {
  const me = members.find((m) => m.user_id === userId);
  const role = me?.role ?? 'member';
  const memberName = (id: string | null | undefined) => {
    if (!id) return 'Unassigned';
    return members.find((m) => m.user_id === id)?.full_name || 'Former member';
  };
  return <ProjectContext.Provider value={{ project, members, role, isOwner: role === 'owner', memberName }}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectState {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside a project route');
  return ctx;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
