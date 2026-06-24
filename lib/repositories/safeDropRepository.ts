import { supabase } from '@/lib/supabase';
import type { SafeDrop, CreateSafeDropData } from '@/types/domain/safeDrop';

export const safeDropRepository = {
  async create(data: CreateSafeDropData): Promise<{ safeDrop: SafeDrop | null; error: any }> {
    const { data: safeDrop, error } = await supabase
      .from('safe_drops')
      .insert({
        shift_id: data.shift_id,
        branch_id: data.branch_id,
        amount: data.amount,
        cashier_id: data.cashier_id,
        receiver_id: data.receiver_id,
      })
      .select()
      .single();

    return { safeDrop, error };
  },

  async getByShift(shiftId: string): Promise<{ drops: SafeDrop[]; error: any }> {
    const { data, error } = await supabase
      .from('safe_drops')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true });

    return { drops: data || [], error };
  },

  async getByBranch(
    branchId: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<{ drops: SafeDrop[]; error: any }> {
    let query = supabase
      .from('safe_drops')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (options?.startDate) query = query.gte('created_at', options.startDate);
    if (options?.endDate) query = query.lte('created_at', options.endDate);

    const { data, error } = await query;
    return { drops: data || [], error };
  },
};
