import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Tables } from '../../shared/database.types';
import { supabase } from './supabase';

export type Task = Tables<'tasks'>;
export type TaskLink = Tables<'task_links'>;
export type LogEntry = Tables<'activity_log'>;

export const taskKeys = {
  list: (projectId: string) => ['tasks', projectId] as const,
  links: (taskId: string) => ['links', taskId] as const,
  log: (projectId: string) => ['log', projectId] as const,
};

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.list(projectId),
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('position').order('created_at');
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, estimated_hours: Number(t.estimated_hours) }));
    },
  });
}

export function useTaskLinks(taskId: string) {
  return useQuery({
    queryKey: taskKeys.links(taskId),
    queryFn: async (): Promise<TaskLink[]> => {
      const { data, error } = await supabase.from('task_links').select('*').eq('task_id', taskId).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLog(projectId: string) {
  return useQuery({
    queryKey: taskKeys.log(projectId),
    queryFn: async (): Promise<LogEntry[]> => {
      const { data, error } = await supabase.from('activity_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Realtime: every member sees board and log changes as they happen. RLS applies to the
// change feed, so only rows the member can read are delivered.
export function useProjectRealtime(projectId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`project:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, () => {
        void qc.invalidateQueries({ queryKey: taskKeys.list(projectId) });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `project_id=eq.${projectId}` }, () => {
        void qc.invalidateQueries({ queryKey: taskKeys.log(projectId) });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_links' }, (payload) => {
        const taskId = (payload.new as { task_id?: string }).task_id;
        if (taskId) void qc.invalidateQueries({ queryKey: taskKeys.links(taskId) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brief_analyses', filter: `project_id=eq.${projectId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['analyses', projectId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, qc]);
}

export type Review = { kind: 'confirmed' | 'flagged'; actor_id: string | null; created_at: string; note: string | null };

// Confirmations and flags for the task's current completion, read from the append only log.
export function reviewsFor(log: LogEntry[], task: Task): Review[] {
  return log
    .filter((e) => e.task_id === task.id && e.completion_seq === task.completion_seq && (e.event === 'task_confirmed' || e.event === 'task_flagged'))
    .map((e) => ({
      kind: e.event === 'task_confirmed' ? ('confirmed' as const) : ('flagged' as const),
      actor_id: e.actor_id,
      created_at: e.created_at,
      note: typeof (e.payload as { note?: unknown }).note === 'string' ? ((e.payload as { note: string }).note) : null,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
