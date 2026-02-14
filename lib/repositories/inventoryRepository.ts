// Inventory Repository - Handles inventory data access
import { supabase } from '@/lib/supabase';
import type { InventoryItem, CreateInventoryItemData, UpdateInventoryItemData } from '@/types/domain/inventory';

export const inventoryRepository = {
  // Create a new inventory item
  async create(branchId: string, data: CreateInventoryItemData): Promise<{ item: InventoryItem | null; error: any }> {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        branch_id: branchId,
        name: data.name,
        price: data.price,
        category_id: data.category_id || null,
        description: data.description || null,
        cost: data.cost || null,
        stock: data.stock || 0,
        barcode: data.barcode || null,
        img_url: data.img_url || null,
        status: data.status || 'active',
      })
      .select()
      .single();

    return { item, error };
  },

  // Get all inventory items for a branch
  async getByBranch(branchId: string): Promise<{ items: InventoryItem[]; error: any }> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    return { items: data || [], error };
  },

  // Get single item by ID
  async getById(id: string): Promise<{ item: InventoryItem | null; error: any }> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    return { item: data, error };
  },

  // Get items by category
  async getByCategory(branchId: string, categoryId: string): Promise<{ items: InventoryItem[]; error: any }> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('branch_id', branchId)
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    return { items: data || [], error };
  },

  // Update item
  async update(id: string, data: UpdateInventoryItemData): Promise<{ item: InventoryItem | null; error: any }> {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    return { item, error };
  },

  // Bulk update stock for multiple items
  async bulkUpdateStock(updates: Array<{ id: string; stock: number }>): Promise<{ error: any }> {
    const promises = updates.map(update =>
      supabase
        .from('inventory_items')
        .update({ stock: update.stock })
        .eq('id', update.id)
    );

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error).map(r => r.error);

    return { error: errors.length > 0 ? errors : null };
  },

  // Delete item
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Subscribe to inventory changes for a branch
  subscribe(branchId: string, callback: (items: InventoryItem[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ items }) => callback(items));

    const channel = supabase
      .channel(`inventory-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          // Refetch items when any change occurs
          this.getByBranch(branchId).then(({ items }) => callback(items));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
