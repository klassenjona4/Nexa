import { supabase } from './supabase';
import { ApiError } from './api';

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Downloads an authenticated API response as a file.
export async function downloadFromApi(path: string, fallbackName: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, { headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {} });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? 'server_error');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  saveBlob(await res.blob(), name);
}
