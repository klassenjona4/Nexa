import { adminClient } from '../supabase.js';

export const BRIEF_BUCKET = 'briefs';
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

export function isPdf(bytes: Uint8Array): boolean {
  // File signature: %PDF-
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

// Storage objects are not removed by database cascades, so every flow that deletes a project
// also removes its files. The daily cron sweeps anything left behind.
export async function purgeProjectFiles(projectIds: string[]): Promise<void> {
  const storage = adminClient().storage.from(BRIEF_BUCKET);
  for (const id of projectIds) {
    const { data } = await storage.list(id, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${id}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  }
}
