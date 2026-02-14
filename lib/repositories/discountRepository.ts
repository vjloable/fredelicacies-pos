// Discount Repository - Handles discount data access
import { supabase } from '@/lib/supabase';
import type { Discount, CreateDiscountData, UpdateDiscountData } from '@/types/domain/discount';

export const discountRepository = {
  // Create a new discount
  async create(branchId: string, data: CreateDiscountData): Promise<{ discount: Discount | null; error: any }> {
    const { data: discount, error } = await supabase
      .from('discounts')
      .insert({
        branch_id: branchId,
        name: data.name,
        type: data.type,
        value: data.value,
        status: data.status || 'active',
      })
      .select()
      .single();

    return { discount, error };
  },

  // Get all discounts for a branch
  async getByBranch(branchId: string): Promise<{ discounts: Discount[]; error: any }> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    return { discounts: data || [], error };
  },

  // Get active discounts only
  async getActiveByBranch(branchId: string): Promise<{ discounts: Discount[]; error: any }> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .order('name', { ascending: true });

    return { discounts: data || [], error };
  },

  // Get single discount by ID
  async getById(id: string): Promise<{ discount: Discount | null; error: any }> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('id', id)
      .single();

    return { discount: data, error };
  },

  // Update discount
  async update(id: string, data: UpdateDiscountData): Promise<{ discount: Discount | null; error: any }> {
    const { data: discount, error } = await supabase
      .from('discounts')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    return { discount, error };
  },

  // Delete discount
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Subscribe to discount changes for a branch
  subscribe(branchId: string, callback: (discounts: Discount[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ discounts }) => callback(discounts));

    const channel = supabase
      .channel(`discounts-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discounts',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranch(branchId).then(({ discounts }) => callback(discounts));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
