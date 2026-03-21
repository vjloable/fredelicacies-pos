// Category EOD Policy Repository - Handles per-branch, per-category EOD rules
import { supabase } from '@/lib/supabase';
import type { CategoryEodPolicy, EodPolicy } from '@/types/domain/category';

export const categoryEodPolicyRepository = {
  // Get all policies for a branch
  async getByBranch(branchId: string): Promise<{ policies: CategoryEodPolicy[]; error: any }> {
    const { data, error } = await supabase
      .from('category_eod_policies')
      .select('*')
      .eq('branch_id', branchId);

    return { policies: data || [], error };
  },

  // Upsert a policy (insert or update)
  async upsert(branchId: string, categoryId: string, eodPolicy: EodPolicy): Promise<{ policy: CategoryEodPolicy | null; error: any }> {
    const { data, error } = await supabase
      .from('category_eod_policies')
      .upsert(
        { branch_id: branchId, category_id: categoryId, eod_policy: eodPolicy },
        { onConflict: 'branch_id,category_id' }
      )
      .select()
      .single();

    return { policy: data, error };
  },

  // Delete a policy (revert to default carryover behavior)
  async delete(branchId: string, categoryId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('category_eod_policies')
      .delete()
      .eq('branch_id', branchId)
      .eq('category_id', categoryId);

    return { error };
  },

  // Subscribe to policy changes for a branch
  subscribe(branchId: string, callback: (policies: CategoryEodPolicy[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ policies }) => {
      callback(policies);
    });

    const channel = supabase
      .channel(`category-eod-policies-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'category_eod_policies',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranch(branchId).then(({ policies }) => {
            callback(policies);
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
