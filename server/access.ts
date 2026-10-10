import { type Db, dbError } from './supabase.js';
import { forbidden, notFound } from './http.js';

export type ProjectAccess = {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  module_code: string;
  final_deadline: string | null;
  plan: string;
  role: 'owner' | 'member';
};

// Loads a project through the user's own client. RLS returns nothing for non-members, so a
// missing row means "not found", whatever id the client sent.
export async function projectAccess(db: Db, projectId: string, userId: string): Promise<ProjectAccess> {
  const { data, error } = await db
    .from('projects')
    .select('id, group_id, title, module_code, final_deadline, plan, groups(name)')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound();
  const { data: member, error: mErr } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', data.group_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (mErr) throw dbError(mErr);
  if (!member) throw notFound();
  return {
    id: data.id,
    group_id: data.group_id,
    group_name: data.groups?.name ?? '',
    title: data.title,
    module_code: data.module_code,
    final_deadline: data.final_deadline,
    plan: data.plan,
    role: member.role,
  };
}

export async function groupRole(db: Db, groupId: string, userId: string): Promise<'owner' | 'member'> {
  const { data, error } = await db.from('group_members').select('role').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound();
  return data.role;
}

export function requireOwnerRole(role: 'owner' | 'member'): void {
  if (role !== 'owner') throw forbidden();
}
