// EOD Repository - Handles End-of-Day audit data access
import { supabase } from '@/lib/supabase';
import type {
  EodSession,
  EodItemLock,
  CreateEodItemLockData,
  UpdateEodItemLockData,
} from '@/types/domain/eod';

export const eodRepository = {
  // Get or create the EOD session for a branch + date (upsert on unique constraint)
  async getOrCreateSession(
    branchId: string,
    date: string, // 'YYYY-MM-DD'
    userId: string | null
  ): Promise<{ session: EodSession | null; error: any }> {
    // Try to fetch existing session first
    const { data: existing, error: fetchError } = await supabase
      .from('eod_sessions')
      .select('*')
      .eq('branch_id', branchId)
      .eq('audit_date', date)
      .maybeSingle();

    if (fetchError) return { session: null, error: fetchError };
    if (existing) return { session: existing as EodSession, error: null };

    // Create new session
    const { data, error } = await supabase
      .from('eod_sessions')
      .insert({ branch_id: branchId, audit_date: date, created_by: userId })
      .select()
      .single();

    return { session: data as EodSession | null, error };
  },

  // Get the session for a branch + date (read-only)
  async getSession(
    branchId: string,
    date: string
  ): Promise<{ session: EodSession | null; error: any }> {
    const { data, error } = await supabase
      .from('eod_sessions')
      .select('*')
      .eq('branch_id', branchId)
      .eq('audit_date', date)
      .maybeSingle();

    return { session: data as EodSession | null, error };
  },

  // Mark session as submitted
  async submitSession(
    sessionId: string,
    userId: string | null
  ): Promise<{ error: any }> {
    const { error } = await supabase
      .from('eod_sessions')
      .update({
        status: 'submitted',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return { error };
  },

  // Upsert a lock row for an item (insert or update if already exists for this session+item)
  async upsertItemLock(
    data: CreateEodItemLockData
  ): Promise<{ lock: EodItemLock | null; error: any }> {
    const { data: lock, error } = await supabase
      .from('eod_item_locks')
      .upsert(
        {
          session_id: data.session_id,
          branch_id: data.branch_id,
          audit_date: data.audit_date,
          item_id: data.item_id,
          item_name: data.item_name,
          expected_stock: data.expected_stock,
          locked_stock: data.locked_stock,
          resolution: data.resolution ?? null,
          resolution_reason: data.resolution_reason ?? null,
          locked_by: data.locked_by,
          locked_at: new Date().toISOString(),
          status: 'locked',
        },
        { onConflict: 'session_id,item_id' }
      )
      .select()
      .single();

    return { lock: lock as EodItemLock | null, error };
  },

  // Update an existing lock (e.g. to set resolution or unlock)
  async updateItemLock(
    lockId: string,
    updates: UpdateEodItemLockData
  ): Promise<{ lock: EodItemLock | null; error: any }> {
    const { data, error } = await supabase
      .from('eod_item_locks')
      .update(updates)
      .eq('id', lockId)
      .select()
      .single();

    return { lock: data as EodItemLock | null, error };
  },

  // Delete a lock (unlock)
  async deleteItemLock(lockId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('eod_item_locks')
      .delete()
      .eq('id', lockId);

    return { error };
  },

  // Get all locks for a session/date
  async getItemLocks(
    branchId: string,
    date: string
  ): Promise<{ locks: EodItemLock[]; error: any }> {
    const { data, error } = await supabase
      .from('eod_item_locks')
      .select('*')
      .eq('branch_id', branchId)
      .eq('audit_date', date)
      .order('locked_at', { ascending: true });

    return { locks: (data ?? []) as EodItemLock[], error };
  },

  // Get locks across a date range (for sales page metrics)
  async getItemLocksRange(
    branchId: string,
    startDate: string,
    endDate: string
  ): Promise<{ locks: EodItemLock[]; error: any }> {
    const { data, error } = await supabase
      .from('eod_item_locks')
      .select('*')
      .eq('branch_id', branchId)
      .gte('audit_date', startDate)
      .lte('audit_date', endDate)
      .order('audit_date', { ascending: true });

    return { locks: (data ?? []) as EodItemLock[], error };
  },

  // Mark all locks in a session as submitted
  async submitAllLocks(sessionId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('eod_item_locks')
      .update({ status: 'submitted' })
      .eq('session_id', sessionId);

    return { error };
  },

  // Subscribe to lock changes for a branch/date (realtime)
  subscribe(
    branchId: string,
    date: string,
    callback: (locks: EodItemLock[]) => void
  ): () => void {
    // Initial fetch
    this.getItemLocks(branchId, date).then(({ locks }) => callback(locks));

    const channel = supabase
      .channel(`eod-locks-${branchId}-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eod_item_locks',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getItemLocks(branchId, date).then(({ locks }) => callback(locks));
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  },
};
