// Inventory Repository - Handles inventory data access
import { supabase } from '@/lib/supabase';
import type { InventoryItem, CreateInventoryItemData, UpdateInventoryItemData } from '@/types/domain/inventory';

// Module-level callback registry for immediate post-mutation refresh
const activeCallbacks = new Map<string, Set<(items: InventoryItem[]) => void>>();
// Map itemId → branchId so update/delete can find which branch to refresh
const itemBranchIndex = new Map<string, string>();

function registerItems(items: InventoryItem[], branchId: string) {
  items.forEach(item => { if (item.id) itemBranchIndex.set(item.id, branchId); });
}

function mapCategoryIds(raw: any): InventoryItem {
  const { inventory_item_categories, ...item } = raw;
  return {
    ...item,
    category_ids: (inventory_item_categories || []).map((r: { category_id: string }) => r.category_id),
  };
}

export const inventoryRepository = {
  // Create a new inventory item
  async create(branchId: string, data: CreateInventoryItemData): Promise<{ item: InventoryItem | null; error: any }> {
    const categoryIds = data.category_ids ?? (data.category_id ? [data.category_id] : []);
    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        branch_id: branchId,
        name: data.name,
        price: data.price,
        category_id: categoryIds[0] ?? null,
        description: data.description || null,
        cost: data.cost || null,
        grab_price: data.grab_price ?? null,
        stock: data.stock || 0,
        barcode: data.barcode || null,
        img_url: data.img_url || null,
        status: data.status || 'active',
      })
      .select()
      .single();

    if (item && categoryIds.length > 0) {
      await supabase.from('inventory_item_categories').insert(
        categoryIds.map(catId => ({ inventory_item_id: item.id, category_id: catId }))
      );
    }

    return { item: item ? { ...item, category_ids: categoryIds } : null, error };
  },

  // Get all inventory items for a branch
  async getByBranch(branchId: string): Promise<{ items: InventoryItem[]; error: any }> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, inventory_item_categories(category_id)')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    const items: InventoryItem[] = (data || []).map(mapCategoryIds);
    return { items, error };
  },

  // Get single item by ID
  async getById(id: string): Promise<{ item: InventoryItem | null; error: any }> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, inventory_item_categories(category_id)')
      .eq('id', id)
      .single();

    return { item: data ? mapCategoryIds(data) : null, error };
  },

  // Get items by category
  async getByCategory(branchId: string, categoryId: string): Promise<{ items: InventoryItem[]; error: any }> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, inventory_item_categories(category_id)')
      .eq('branch_id', branchId)
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    const items: InventoryItem[] = (data || []).map(mapCategoryIds);
    return { items, error };
  },

  // Update item
  async update(id: string, data: UpdateInventoryItemData): Promise<{ item: InventoryItem | null; error: any }> {
    const { category_ids, ...dbData } = data;

    // Keep category_id in sync with the first selected category
    if (category_ids !== undefined) {
      dbData.category_id = category_ids[0] ?? undefined;
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (item && category_ids !== undefined) {
      await supabase.from('inventory_item_categories').delete().eq('inventory_item_id', id);
      if (category_ids.length > 0) {
        await supabase.from('inventory_item_categories').insert(
          category_ids.map(catId => ({ inventory_item_id: id, category_id: catId }))
        );
      }
    }

    const resolvedCategoryIds = category_ids ?? [];
    return { item: item ? { ...item, category_ids: resolvedCategoryIds } : null, error };
  },

  // Bulk update stock for multiple items using incremental updates
  async bulkUpdateStock(updates: Array<{ id: string; stock: number }>): Promise<{ error: any }> {
    const promises = updates.map(update =>
      supabase.rpc('increment_stock', {
        item_id: update.id,
        stock_delta: update.stock  // Positive to add, negative to subtract
      })
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

  // Immediately notify all subscribers for a branch (call after mutations)
  async triggerRefresh(branchId: string): Promise<void> {
    const cbs = activeCallbacks.get(branchId);
    if (!cbs || cbs.size === 0) return;
    const { items } = await this.getByBranch(branchId);
    registerItems(items, branchId);
    cbs.forEach(cb => cb(items));
  },

  // Trigger refresh when only item ID is known (update/delete use case)
  async triggerRefreshByItemId(itemId: string): Promise<void> {
    const branchId = itemBranchIndex.get(itemId);
    if (branchId) await this.triggerRefresh(branchId);
  },

  // Subscribe to inventory changes for a branch
  subscribe(branchId: string, callback: (items: InventoryItem[]) => void) {
    // Register callback for immediate post-mutation refresh
    if (!activeCallbacks.has(branchId)) {
      activeCallbacks.set(branchId, new Set());
    }
    activeCallbacks.get(branchId)!.add(callback);

    // Initial fetch
    this.getByBranch(branchId).then(({ items }) => {
      registerItems(items, branchId);
      callback(items);
    });

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
          this.getByBranch(branchId).then(({ items }) => {
            registerItems(items, branchId);
            callback(items);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_item_categories',
        },
        () => {
          this.getByBranch(branchId).then(({ items }) => {
            registerItems(items, branchId);
            callback(items);
          });
        }
      )
      .subscribe();

    return () => {
      activeCallbacks.get(branchId)?.delete(callback);
      channel.unsubscribe();
    };
  },
};
