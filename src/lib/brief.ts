import { useQuery } from '@tanstack/react-query';
import { analysisResult, type AnalysisResult } from '../../shared/schemas/brief';
import { supabase } from './supabase';

export type Analysis = {
  id: string;
  status: 'processing' | 'ready' | 'failed';
  source: 'pdf' | 'text';
  file_name: string | null;
  file_size: number | null;
  error_code: string | null;
  created_at: string;
  accepted_at: string | null;
  storage_path: string | null;
  result: AnalysisResult | null;
};

export function useLatestAnalyses(projectId: string) {
  return useQuery({
    queryKey: ['analyses', projectId],
    queryFn: async (): Promise<Analysis[]> => {
      const { data, error } = await supabase
        .from('brief_analyses')
        .select('id, status, source, file_name, file_size, error_code, created_at, accepted_at, storage_path, result')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((a) => {
        const parsed = a.result ? analysisResult.safeParse(a.result) : null;
        return { ...a, result: parsed?.success ? parsed.data : null };
      });
    },
  });
}

export type Usage = { used: number; max: number };

// Usage is shown to members but counted and enforced only on the server.
export function useUsage(projectId: string, plan: string, kind: 'brief_breakdown' | 'statement_generation') {
  return useQuery({
    queryKey: ['usage', projectId, kind],
    queryFn: async (): Promise<Usage> => {
      const [limit, usage] = await Promise.all([
        supabase.from('plan_limits').select('max_per_project').eq('plan', plan).eq('kind', kind).maybeSingle(),
        supabase.from('project_usage').select('used').eq('project_id', projectId).eq('kind', kind).maybeSingle(),
      ]);
      if (limit.error) throw limit.error;
      if (usage.error) throw usage.error;
      return { used: usage.data?.used ?? 0, max: limit.data?.max_per_project ?? 0 };
    },
  });
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function looksLikePdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return head.length === 5 && String.fromCharCode(...head) === '%PDF-';
}
