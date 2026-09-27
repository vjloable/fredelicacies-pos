// Cash on Hand Repository - Handles editable per-branch, per-day cash ledger data access
import { supabase } from '@/lib/supabase';
import type {
  CashOnHand,
  CreateCashOnHandData,
  CashOnHandEdit,
} from '@/types/domain/cashOnHand';

export const cashOnHandRepository = {
  // Get all cash-on-hand rows for a branch within a date range (newest first)
  async getByBranchRange(
    branchId: string,
    startDate: string, // 'YYYY-MM-DD'
    endDate: string // 'YYYY-MM-DD'
  ): Promise<{ entries: CashOnHand[]; error: any }> {
    const { data, error } = await supabase
      .from('cash_on_hand')
      .select('*')
      .eq('branch_id', branchId)
      .gte('business_date', startDate)
      .lte('business_date', endDate)
      .order('business_date', { ascending: false });

    return { entries: (data ?? []) as CashOnHand[], error };
  },

  // Get the row for a branch + date (read-only)
  async getForDate(
    branchId: string,
    businessDate: string
  ): Promise<{ entry: CashOnHand | null; error: any }> {
    const { data, error } = await supabase
      .from('cash_on_hand')
      .select('*')
      .eq('branch_id', branchId)
      .eq('business_date', businessDate)
      .maybeSingle();

    return { entry: (data as CashOnHand | null) ?? null, error };
  },

  // Create a new day row (audit trail written by the DB trigger)
  async create(
    data: CreateCashOnHandData
  ): Promise<{ entry: CashOnHand | null; error: any }> {
    const { data: entry, error } = await supabase
      .from('cash_on_hand')
      .insert({
        branch_id: data.branch_id,
        business_date: data.business_date,
        amount: data.amount,
        created_by: data.created_by,
        updated_by: data.created_by,
      })
      .select()
      .single();

    return { entry: (entry as CashOnHand | null) ?? null, error };
  },

  // Update the amount for an existing row (audit trail written by the DB trigger)
  async updateAmount(
    id: string,
    amount: number,
    updatedBy: string | null
  ): Promise<{ entry: CashOnHand | null; error: any }> {
    const { data, error } = await supabase
      .from('cash_on_hand')
      .update({ amount, updated_by: updatedBy })
      .eq('id', id)
      .select()
      .single();

    return { entry: (data as CashOnHand | null) ?? null, error };
  },

  // Get the edit history for a row (newest first), with editor names resolved
  async getEdits(
    cashOnHandId: string
  ): Promise<{ edits: CashOnHandEdit[]; error: any }> {
    const { data, error } = await supabase
      .from('cash_on_hand_edits')
      .select('*, user_profiles(name)')
      .eq('cash_on_hand_id', cashOnHandId)
      .order('edited_at', { ascending: false });

    if (error) return { edits: [], error };

    const edits: CashOnHandEdit[] = (data ?? []).map((row: any) => ({
      ...row,
      editor_name: row.user_profiles?.name ?? null,
    }));

    return { edits, error: null };
  },

  // Subscribe to cash-on-hand changes for a branch (realtime).
  // Re-fetches the given range on any change and hands it back to the caller.
  subscribe(
    branchId: string,
    startDate: string,
    endDate: string,
    callback: (entries: CashOnHand[]) => void
  ): () => void {
    // Initial fetch
    this.getByBranchRange(branchId, startDate, endDate).then(({ entries }) =>
      callback(entries)
    );

    const channel = supabase
      .channel(`cash-on-hand-${branchId}-${startDate}-${endDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_on_hand',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranchRange(branchId, startDate, endDate).then(({ entries }) =>
            callback(entries)
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
