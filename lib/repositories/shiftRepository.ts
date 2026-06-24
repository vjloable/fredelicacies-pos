import { supabase } from '@/lib/supabase';
import type { Shift, CreateShiftData, CloseShiftData } from '@/types/domain/shift';

export const shiftRepository = {
  async create(data: CreateShiftData): Promise<{ shift: Shift | null; error: any }> {
    const { data: shift, error } = await supabase
      .from('shifts')
      .insert({
        branch_id: data.branch_id,
        cashier_id: data.cashier_id,
        beginning_cash: data.beginning_cash,
        status: 'open',
      })
      .select()
      .single();

    return { shift, error };
  },

  async getOpenShift(branchId: string, cashierId: string): Promise<{ shift: Shift | null; error: any }> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { shift: data, error };
  },

  async close(shiftId: string, data: CloseShiftData): Promise<{ shift: Shift | null; error: any }> {
    const { data: shift, error } = await supabase
      .from('shifts')
      .update({
        closed_at: new Date().toISOString(),
        actual_cash: data.actual_cash,
        expected_cash: data.expected_cash,
        over_short: data.over_short,
        remarks: data.remarks || null,
        status: 'closed',
      })
      .eq('id', shiftId)
      .select()
      .single();

    return { shift, error };
  },

  async getById(id: string): Promise<{ shift: Shift | null; error: any }> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single();

    return { shift: data, error };
  },

  async getByBranch(
    branchId: string,
    options?: { startDate?: string; endDate?: string; status?: 'open' | 'closed' }
  ): Promise<{ shifts: Shift[]; error: any }> {
    let query = supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false });

    if (options?.startDate) query = query.gte('opened_at', options.startDate);
    if (options?.endDate) query = query.lte('opened_at', options.endDate);
    if (options?.status) query = query.eq('status', options.status);

    const { data, error } = await query;
    return { shifts: data || [], error };
  },
};
