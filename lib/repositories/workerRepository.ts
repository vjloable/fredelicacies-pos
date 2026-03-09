// Worker Repository - Handles worker data access
import { supabase } from '@/lib/supabase';
import type { Worker, CreateWorkerData, UpdateWorkerData } from '@/types/domain/worker';

export const workerRepository = {
  // Create a new worker
  async create(branchId: string, data: CreateWorkerData): Promise<{ worker: Worker | null; error: any }> {
    const { error } = await supabase
      .from('workers')
      .insert({
        branch_id: branchId,
        user_id: data.user_id,
        pin: data.pin || null,
        role: data.role || 'worker',
        face_descriptor: data.face_descriptor || null,
        status: data.status || 'active',
      });

    if (error) return { worker: null, error };

    const { data: worker } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', data.user_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    return { worker, error: null };
  },

  // Get all workers for a branch
  async getByBranch(branchId: string): Promise<{ workers: Worker[]; error: any }> {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true });

    return { workers: data || [], error };
  },

  // Get active workers only
  async getActiveByBranch(branchId: string): Promise<{ workers: Worker[]; error: any }> {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    return { workers: data || [], error };
  },

  // Get single worker by ID
  async getById(id: string): Promise<{ worker: Worker | null; error: any }> {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('id', id)
      .single();

    return { worker: data, error };
  },

  // Get worker by user_id
  async getByUserId(userId: string): Promise<{ worker: Worker | null; error: any }> {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .single();

    return { worker: data, error };
  },

  // Get worker by PIN for a branch
  async getByPin(branchId: string, pin: string): Promise<{ worker: Worker | null; error: any }> {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('branch_id', branchId)
      .eq('pin', pin)
      .eq('status', 'active')
      .single();

    return { worker: data, error };
  },

  // Update worker
  async update(id: string, data: UpdateWorkerData): Promise<{ worker: Worker | null; error: any }> {
    const { error } = await supabase
      .from('workers')
      .update(data)
      .eq('id', id);

    if (error) return { worker: null, error };

    // Fetch the updated row separately — use maybeSingle so 0 rows (RLS
    // visibility edge cases) returns null instead of throwing PGRST116
    const { data: worker } = await supabase
      .from('workers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return { worker, error: null };
  },

  // Delete worker
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Get workers with manager role
  async getManagersByBranch(branchId: string): Promise<{ workers: Worker[]; error: any }> {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('branch_id', branchId)
      .eq('role', 'manager')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    return { workers: data || [], error };
  },

  // Subscribe to worker changes for a branch
  subscribe(branchId: string, callback: (workers: Worker[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ workers }) => callback(workers));

    const channel = supabase
      .channel(`workers-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workers',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranch(branchId).then(({ workers }) => callback(workers));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
