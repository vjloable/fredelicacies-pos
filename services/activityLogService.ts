import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logging';
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

    log.info('Activity logged', {
      branchId: params.branchId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
    });
  } catch (err) {
    log.error('Failed to log activity', err as Error, {
      branchId: params.branchId,
      userId: params.userId,
      action: params.action,
    });
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

const ALL_LOGS_PAGE_SIZE = 20;

export async function getAllActivityLogs(options?: {
  from?: Date;
  to?: Date;
  before?: string; // cursor: fetch items with created_at < this ISO string
  limit?: number;
}): Promise<{ logs: ActivityLog[]; hasMore: boolean; error: any }> {
  const limit = options?.limit ?? ALL_LOGS_PAGE_SIZE;

  let query = supabase
    .from('activity_logs')
    .select('*, user_profiles(name)')
    .order('created_at', { ascending: false })
    .limit(limit + 1); // one extra to detect hasMore

  if (options?.before) {
    query = query.lt('created_at', options.before);
  }
  if (options?.from) {
    query = query.gte('created_at', options.from.toISOString());
  }
  if (options?.to) {
    query = query.lte('created_at', options.to.toISOString());
  }

  const { data, error } = await query;

  if (error) return { logs: [], hasMore: false, error };

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const logs: ActivityLog[] = (hasMore ? rows.slice(0, limit) : rows).map((row: any) => ({
    ...row,
    user_name: row.user_profiles?.name ?? undefined,
  }));

  return { logs, hasMore, error: null };
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
