import { supabase } from '@/lib/supabase';
import type { WriteOff, CreateWriteOffData } from '@/types/domain/writeOff';

export const writeOffRepository = {
  async create(data: CreateWriteOffData): Promise<{ writeOff: WriteOff | null; error: any }> {
    const { data: writeOff, error } = await supabase
      .from('write_offs')
      .insert({
        shift_id: data.shift_id || null,
        branch_id: data.branch_id,
        type: data.type,
        item_id: data.item_id || null,
        item_name: data.item_name,
        quantity: data.quantity,
        amount: data.amount,
        reason: data.reason || null,
        created_by: data.created_by,
      })
      .select()
      .single();

    return { writeOff, error };
  },

  async getByShift(shiftId: string): Promise<{ writeOffs: WriteOff[]; error: any }> {
    const { data, error } = await supabase
      .from('write_offs')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true });

    return { writeOffs: data || [], error };
  },

  async getByBranch(
    branchId: string,
    options?: { startDate?: string; endDate?: string; type?: 'free' | 'near_expiry' }
  ): Promise<{ writeOffs: WriteOff[]; error: any }> {
    let query = supabase
      .from('write_offs')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (options?.startDate) query = query.gte('created_at', options.startDate);
    if (options?.endDate) query = query.lte('created_at', options.endDate);
    if (options?.type) query = query.eq('type', options.type);

    const { data, error } = await query;
    return { writeOffs: data || [], error };
  },
};
