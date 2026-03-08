import { supabase } from '@/lib/supabase';
import type { ActivityLog } from '@/types/domain';

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function logActivity(params: {
  branchId: string | null;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      branch_id: params.branchId ?? null,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
    });
  } catch {
    // Never throw — logging must never break the calling code
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getActivityLogs(
  branchId: string,
  options?: {
    from?: Date;
    to?: Date;
    actions?: string[];
  }
): Promise<{ logs: ActivityLog[]; error: any }> {
  let query = supabase
    .from('activity_logs')
    .select('*, user_profiles(name)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: true })
    .limit(300);

  if (options?.from) {
    query = query.gte('created_at', options.from.toISOString());
  }
  if (options?.to) {
    query = query.lte('created_at', options.to.toISOString());
  }
  if (options?.actions && options.actions.length > 0) {
    query = query.in('action', options.actions);
  }

  const { data, error } = await query;

  if (error) return { logs: [], error };

  const logs: ActivityLog[] = (data ?? []).map((row: any) => ({
    ...row,
    user_name: row.user_profiles?.name ?? undefined,
  }));

  return { logs, error: null };
}

export async function getAllActivityLogs(options?: {
  from?: Date;
  to?: Date;
}): Promise<{ logs: ActivityLog[]; error: any }> {
  let query = supabase
    .from('activity_logs')
    .select('*, user_profiles(name)')
    .order('created_at', { ascending: true })
    .limit(500);

  if (options?.from) {
    query = query.gte('created_at', options.from.toISOString());
  }
  if (options?.to) {
    query = query.lte('created_at', options.to.toISOString());
  }

  const { data, error } = await query;

  if (error) return { logs: [], error };

  const logs: ActivityLog[] = (data ?? []).map((row: any) => ({
    ...row,
    user_name: row.user_profiles?.name ?? undefined,
  }));

  return { logs, error: null };
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export function subscribeToActivityLogs(
  branchId: string,
  callback: (log: ActivityLog) => void
): () => void {
  const channel = supabase
    .channel(`activity_logs_branch_${branchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
        filter: `branch_id=eq.${branchId}`,
      },
      (payload) => {
        callback(payload.new as ActivityLog);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToAllActivityLogs(
  callback: (log: ActivityLog) => void
): () => void {
  const channel = supabase
    .channel('activity_logs_all')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_logs' },
      (payload) => {
        callback(payload.new as ActivityLog);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
