// Generated from the Supabase schema (project fauotybbzqlerctitcsc) with the Supabase connector.
// Regenerate after every migration. Relationship metadata is kept so typed joins work.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      activity_log: {
        Row: { actor_id: string | null; completion_seq: number | null; created_at: string; event: Database['public']['Enums']['log_event']; id: number; payload: Json; project_id: string; task_id: string | null; task_title: string | null };
        Insert: { actor_id?: string | null; completion_seq?: number | null; created_at?: string; event: Database['public']['Enums']['log_event']; id?: never; payload?: Json; project_id: string; task_id?: string | null; task_title?: string | null };
        Update: { actor_id?: string | null; completion_seq?: number | null; created_at?: string; event?: Database['public']['Enums']['log_event']; id?: never; payload?: Json; project_id?: string; task_id?: string | null; task_title?: string | null };
        Relationships: [
          { foreignKeyName: 'activity_log_actor_id_fkey'; columns: ['actor_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'activity_log_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
        ];
      };
      brief_analyses: {
        Row: { completed_at: string | null; created_at: string; created_by: string | null; error_code: string | null; file_name: string | null; file_size: number | null; id: string; project_id: string; result: Json | null; source: Database['public']['Enums']['brief_source']; status: Database['public']['Enums']['analysis_status']; storage_path: string | null };
        Insert: { completed_at?: string | null; created_at?: string; created_by?: string | null; error_code?: string | null; file_name?: string | null; file_size?: number | null; id?: string; project_id: string; result?: Json | null; source: Database['public']['Enums']['brief_source']; status?: Database['public']['Enums']['analysis_status']; storage_path?: string | null };
        Update: { completed_at?: string | null; created_at?: string; created_by?: string | null; error_code?: string | null; file_name?: string | null; file_size?: number | null; id?: string; project_id?: string; result?: Json | null; source?: Database['public']['Enums']['brief_source']; status?: Database['public']['Enums']['analysis_status']; storage_path?: string | null };
        Relationships: [
          { foreignKeyName: 'brief_analyses_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'brief_analyses_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
        ];
      };
      calendar_feeds: {
        Row: { created_at: string; id: string; last_read_at: string | null; nonce: string; project_id: string; revoked_at: string | null; token_hash: string; user_id: string };
        Insert: { created_at?: string; id?: string; last_read_at?: string | null; nonce: string; project_id: string; revoked_at?: string | null; token_hash: string; user_id: string };
        Update: { created_at?: string; id?: string; last_read_at?: string | null; nonce?: string; project_id?: string; revoked_at?: string | null; token_hash?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: 'calendar_feeds_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'calendar_feeds_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      group_members: {
        Row: { group_id: string; joined_at: string; role: Database['public']['Enums']['member_role']; user_id: string };
        Insert: { group_id: string; joined_at?: string; role?: Database['public']['Enums']['member_role']; user_id: string };
        Update: { group_id?: string; joined_at?: string; role?: Database['public']['Enums']['member_role']; user_id?: string };
        Relationships: [
          { foreignKeyName: 'group_members_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] },
          { foreignKeyName: 'group_members_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      groups: {
        Row: { created_at: string; created_by: string | null; id: string; name: string };
        Insert: { created_at?: string; created_by?: string | null; id?: string; name: string };
        Update: { created_at?: string; created_by?: string | null; id?: string; name?: string };
        Relationships: [{ foreignKeyName: 'groups_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
      };
      invites: {
        Row: { code_hash: string; created_at: string; created_by: string | null; email: string | null; expires_at: string; group_id: string; id: string; kind: Database['public']['Enums']['invite_kind']; max_uses: number; nonce: string; project_id: string; revoked_at: string | null; use_count: number };
        Insert: { code_hash: string; created_at?: string; created_by?: string | null; email?: string | null; expires_at?: string; group_id: string; id?: string; kind: Database['public']['Enums']['invite_kind']; max_uses: number; nonce: string; project_id: string; revoked_at?: string | null; use_count?: number };
        Update: { code_hash?: string; created_at?: string; created_by?: string | null; email?: string | null; expires_at?: string; group_id?: string; id?: string; kind?: Database['public']['Enums']['invite_kind']; max_uses?: number; nonce?: string; project_id?: string; revoked_at?: string | null; use_count?: number };
        Relationships: [
          { foreignKeyName: 'invites_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'invites_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] },
          { foreignKeyName: 'invites_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
        ];
      };
      plan_limits: {
        Row: { kind: Database['public']['Enums']['usage_kind']; max_per_project: number; plan: string };
        Insert: { kind: Database['public']['Enums']['usage_kind']; max_per_project: number; plan: string };
        Update: { kind?: Database['public']['Enums']['usage_kind']; max_per_project?: number; plan?: string };
        Relationships: [];
      };
      profiles: {
        Row: { created_at: string; full_name: string; id: string; updated_at: string };
        Insert: { created_at?: string; full_name?: string; id: string; updated_at?: string };
        Update: { created_at?: string; full_name?: string; id?: string; updated_at?: string };
        Relationships: [];
      };
      project_usage: {
        Row: { kind: Database['public']['Enums']['usage_kind']; project_id: string; updated_at: string; used: number };
        Insert: { kind: Database['public']['Enums']['usage_kind']; project_id: string; updated_at?: string; used?: number };
        Update: { kind?: Database['public']['Enums']['usage_kind']; project_id?: string; updated_at?: string; used?: number };
        Relationships: [{ foreignKeyName: 'project_usage_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      projects: {
        Row: { brief: Json | null; created_at: string; deletion_warned_at: string | null; final_deadline: string | null; group_id: string; id: string; last_activity_at: string; module_code: string; plan: string; title: string };
        Insert: { brief?: Json | null; created_at?: string; deletion_warned_at?: string | null; final_deadline?: string | null; group_id: string; id?: string; last_activity_at?: string; module_code?: string; plan?: string; title: string };
        Update: { brief?: Json | null; created_at?: string; deletion_warned_at?: string | null; final_deadline?: string | null; group_id?: string; id?: string; last_activity_at?: string; module_code?: string; plan?: string; title?: string };
        Relationships: [{ foreignKeyName: 'projects_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] }];
      };
      rate_limits: {
        Row: { bucket: string; count: number; window_start: string };
        Insert: { bucket: string; count?: number; window_start: string };
        Update: { bucket?: string; count?: number; window_start?: string };
        Relationships: [];
      };
      statements: {
        Row: { edited_at: string | null; edited_by: string | null; generated_at: string; generated_by: string | null; id: string; period_from: string | null; period_to: string | null; project_id: string; sections: Json };
        Insert: { edited_at?: string | null; edited_by?: string | null; generated_at?: string; generated_by?: string | null; id?: string; period_from?: string | null; period_to?: string | null; project_id: string; sections: Json };
        Update: { edited_at?: string | null; edited_by?: string | null; generated_at?: string; generated_by?: string | null; id?: string; period_from?: string | null; period_to?: string | null; project_id?: string; sections?: Json };
        Relationships: [
          { foreignKeyName: 'statements_edited_by_fkey'; columns: ['edited_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'statements_generated_by_fkey'; columns: ['generated_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'statements_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
        ];
      };
      task_links: {
        Row: { added_by: string | null; created_at: string; host: string; id: string; label: string; task_id: string; url: string };
        Insert: { added_by?: string | null; created_at?: string; host?: string; id?: string; label?: string; task_id: string; url: string };
        Update: { added_by?: string | null; created_at?: string; host?: string; id?: string; label?: string; task_id?: string; url?: string };
        Relationships: [
          { foreignKeyName: 'task_links_added_by_fkey'; columns: ['added_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'task_links_task_id_fkey'; columns: ['task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] },
        ];
      };
      tasks: {
        Row: { assignee_id: string | null; completion_seq: number; created_at: string; created_by: string | null; deliverable: string; description: string; due_at: string | null; estimated_hours: number; id: string; position: number; project_id: string; reminder_sent_at: string | null; status: Database['public']['Enums']['task_status']; title: string; updated_at: string };
        Insert: { assignee_id?: string | null; completion_seq?: number; created_at?: string; created_by?: string | null; deliverable?: string; description?: string; due_at?: string | null; estimated_hours?: number; id?: string; position?: number; project_id: string; reminder_sent_at?: string | null; status?: Database['public']['Enums']['task_status']; title: string; updated_at?: string };
        Update: { assignee_id?: string | null; completion_seq?: number; created_at?: string; created_by?: string | null; deliverable?: string; description?: string; due_at?: string | null; estimated_hours?: number; id?: string; position?: number; project_id?: string; reminder_sent_at?: string | null; status?: Database['public']['Enums']['task_status']; title?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'tasks_assignee_id_fkey'; columns: ['assignee_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'tasks_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'tasks_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_brief: { Args: { p_actor: string; p_analysis: string; p_brief: Json; p_project: string; p_tasks: Json }; Returns: number };
      accept_invite: { Args: { p_code_hash: string; p_user: string }; Returns: { already_member: boolean; group_id: string; project_id: string }[] };
      create_group_with_project: { Args: { p_final_deadline: string | null; p_group_name: string; p_module_code: string; p_title: string }; Returns: { group_id: string; project_id: string }[] };
      create_project: { Args: { p_final_deadline: string | null; p_group: string; p_module_code: string; p_title: string }; Returns: string };
      export_my_data: { Args: never; Returns: Json };
      group_member_list: { Args: { p_group: string }; Returns: { email: string; full_name: string; joined_at: string; role: Database['public']['Enums']['member_role']; user_id: string }[] };
      keep_project: { Args: { p_project: string }; Returns: undefined };
      leave_group: { Args: { p_group: string }; Returns: undefined };
      prepare_account_deletion: { Args: { p_user: string }; Returns: undefined };
      rate_limit_hit: { Args: { p_bucket: string; p_max: number; p_window_seconds: number }; Returns: boolean };
      release_usage: { Args: { p_kind: Database['public']['Enums']['usage_kind']; p_project: string }; Returns: undefined };
      reserve_usage: { Args: { p_kind: Database['public']['Enums']['usage_kind']; p_project: string }; Returns: number | null };
      review_task: { Args: { p_kind: string; p_note?: string; p_task: string }; Returns: undefined };
    };
    Enums: {
      analysis_status: 'processing' | 'ready' | 'failed';
      brief_source: 'pdf' | 'text';
      invite_kind: 'link' | 'email';
      log_event: 'group_joined' | 'brief_uploaded' | 'tasks_created' | 'task_created' | 'task_status_changed' | 'task_assigned' | 'task_link_added' | 'task_confirmed' | 'task_flagged' | 'member_left' | 'member_removed';
      member_role: 'owner' | 'member';
      task_status: 'todo' | 'in_progress' | 'done';
      usage_kind: 'brief_breakdown' | 'statement_generation';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
export type TaskStatus = Enums<'task_status'>;
export type LogEvent = Enums<'log_event'>;
export type MemberRole = Enums<'member_role'>;
export type UsageKind = Enums<'usage_kind'>;
// Keeps the Rel helper referenced for future hand edits.
export type _Rel = Rel;
