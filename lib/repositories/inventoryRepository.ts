// Inventory Repository - Handles inventory data access
import { supabase } from '@/lib/supabase';
import type { InventoryItem, CreateInventoryItemData, UpdateInventoryItemData } from '@/types/domain/inventory';
import { readCache, writeCache } from '@/lib/branchCache';

// Persistent cache key for a branch's item list (stale-while-revalidate).
const invCacheKey = (branchId: string) => `inv:${branchId}`;

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

// ─── Centralized menu (Phase 2) ──────────────────────────────────────────────
// Memoized lookup of the single commissary branch id (the menu source).
let commissaryIdCache: string | null | undefined;
async function getCommissaryId(): Promise<string | null> {
  if (commissaryIdCache !== undefined) return commissaryIdCache;
  const { data } = await supabase
    .from('branches')
    .select('id')
    .eq('type', 'commissary')
    .limit(1)
    .maybeSingle();
  const id: string | null = data?.id ?? null;
  commissaryIdCache = id;
  return id;
}

// Adapt a branch_item_stock row (with its embedded commissary item) into the
// existing InventoryItem shape: MENU fields come from the commissary row, STOCK
// from branch_item_stock. Under Phase 3 the item IDENTITY is the COMMISSARY id,
// so carts / order_items / bundle components all resolve to the single source of
// truth (no per-branch duplicate ids). Stock writes translate this commissary id
// back to the branch's stock via `increment_branch_stock`.
function mapCentralizedRow(row: any, branchId: string): InventoryItem | null {
  const c = row.commissary;
  if (!c) return null;
  const { inventory_item_categories, ...menu } = c;
  return {
    ...menu,
    id: c.id,
    branch_id: branchId,
    commissary_item_id: c.id,
    stock: row.stock ?? 0,
    uncarried_stock: row.uncarried_stock ?? 0,
    reserved_stock: row.reserved_stock ?? 0,
    category_ids: (inventory_item_categories || []).map((r: { category_id: string }) => r.category_id),
  } as InventoryItem;
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
        price: data.price ?? 0,
        category_id: categoryIds[0] ?? null,
        description: data.description || null,
        stock: data.stock || 0,
        code: data.code || null,
        barcode: data.barcode || null,
        img_url: data.img_url || null,
        status: data.status || 'active',
        kind: data.kind ?? 'item',
        is_custom: data.is_custom ?? false,
        unit_type: data.unit_type ?? null,
        unit: data.unit ?? null,
        measurement: data.measurement ?? null,
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
    const commissaryId = await getCommissaryId();
    // The commissary is the menu source — it reads its own rows normally.
    if (commissaryId && branchId !== commissaryId) {
      return this.getByBranchCentralized(branchId);
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, inventory_item_categories(category_id)')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    const items: InventoryItem[] = (data || []).map(mapCategoryIds);
    if (!error) writeCache(invCacheKey(branchId), items);
    return { items, error };
  },

  // Centralized read: branch's carried items = branch_item_stock JOIN the
  // commissary source item (menu) for the given branch. Menu from commissary,
  // stock per-branch, id kept branch-local. (Phase 2)
  async getByBranchCentralized(branchId: string): Promise<{ items: InventoryItem[]; error: any }> {
    const { data, error } = await supabase
      .from('branch_item_stock')
      .select(
        'stock, uncarried_stock, reserved_stock, branch_item_id, ' +
        'commissary:inventory_items!branch_item_stock_commissary_item_id_fkey(*, inventory_item_categories(category_id))'
      )
      .eq('branch_id', branchId);

    const items: InventoryItem[] = (data || [])
      .map((row: any) => mapCentralizedRow(row, branchId))
      .filter((i: InventoryItem | null): i is InventoryItem => i !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!error) writeCache(invCacheKey(branchId), items);
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

    // Item identity is the commissary id, so menu fields write to the commissary
    // (menu-source) row directly. Per-branch stock edits are routed to
    // setBranchStock by their callers (e.g. EditItemModal).
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

  // Centralized update (Phase 2): menu fields → commissary source row (shared),
  // stock fields → branch row (mirrored into branch_item_stock). Keeps the
  // branch-local id as identity. The realtime refetch reconciles the UI, so the
  // returned item is a best-effort merge.
  async updateCentralized(
    branchItemId: string,
    commissaryItemId: string,
    dbData: Record<string, any>,
    category_ids: string[] | undefined
  ): Promise<{ item: InventoryItem | null; error: any }> {
    const STOCK_KEYS = new Set(['stock', 'uncarried_stock', 'reserved_stock']);
    const menuData: Record<string, any> = {};
    const stockData: Record<string, any> = {};
    for (const [k, v] of Object.entries(dbData)) {
      (STOCK_KEYS.has(k) ? stockData : menuData)[k] = v;
    }

    let menuRow: any = null;
    let error: any = null;

    // Menu fields → commissary source row (affects every branch that carries it).
    if (Object.keys(menuData).length > 0) {
      const r = await supabase
        .from('inventory_items')
        .update(menuData)
        .eq('id', commissaryItemId)
        .select()
        .single();
      menuRow = r.data;
      error = r.error;
    }

    // Categories → commissary source row.
    if (!error && category_ids !== undefined) {
      await supabase.from('inventory_item_categories').delete().eq('inventory_item_id', commissaryItemId);
      if (category_ids.length > 0) {
        await supabase.from('inventory_item_categories').insert(
          category_ids.map(catId => ({ inventory_item_id: commissaryItemId, category_id: catId }))
        );
      }
    }

    // Stock fields → branch row (the 0018 trigger mirrors them to branch_item_stock).
    let stockRow: any = null;
    if (!error && Object.keys(stockData).length > 0) {
      const r = await supabase
        .from('inventory_items')
        .update(stockData)
        .eq('id', branchItemId)
        .select()
        .single();
      stockRow = r.data;
      if (r.error) error = r.error;
    }

    const base = menuRow ?? stockRow;
    const item = base
      ? ({ ...base, id: branchItemId, commissary_item_id: commissaryItemId, category_ids: category_ids ?? [] } as InventoryItem)
      : null;
    return { item, error };
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

  // Centralized (Phase 3) branch-stock writer. `updates[].id` is a COMMISSARY
  // item id; the RPC resolves it to the branch's stock. Requires the 0019
  // migration (increment_branch_stock). Used by order deduct / refund restock
  // when the flag is on.
  async bulkUpdateBranchStock(
    branchId: string,
    updates: Array<{ id: string; stock: number }>
  ): Promise<{ error: any }> {
    const promises = updates.map(update =>
      supabase.rpc('increment_branch_stock', {
        p_branch_id: branchId,
        p_commissary_item_id: update.id,
        p_delta: update.stock,
      })
    );
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error).map(r => r.error);
    return { error: errors.length > 0 ? errors : null };
  },

  // Resolve a commissary item id → the branch's legacy branch_item_id (or null
  // once branch rows are dropped). (Phase 3)
  async resolveBranchItemId(branchId: string, commissaryItemId: string): Promise<string | null> {
    const { data } = await supabase
      .from('branch_item_stock')
      .select('branch_item_id')
      .eq('branch_id', branchId)
      .eq('commissary_item_id', commissaryItemId)
      .maybeSingle();
    return data?.branch_item_id ?? null;
  },

  // Set ABSOLUTE branch stock fields for a commissary item (Phase 3). While the
  // branch row exists, writes it (0018 mirror syncs branch_item_stock); after the
  // drop, writes branch_item_stock directly. Used by EOD / manual stock edits.
  async setBranchStock(
    branchId: string,
    commissaryItemId: string,
    fields: { stock?: number; uncarried_stock?: number; reserved_stock?: number }
  ): Promise<{ error: any }> {
    const branchItemId = await this.resolveBranchItemId(branchId, commissaryItemId);
    if (branchItemId) {
      const { error } = await supabase
        .from('inventory_items')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', branchItemId);
      return { error };
    }
    const { error } = await supabase
      .from('branch_item_stock')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('branch_id', branchId)
      .eq('commissary_item_id', commissaryItemId);
    return { error };
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

    const refetch = () => {
      this.getByBranch(branchId).then(({ items }) => {
        registerItems(items, branchId);
        callback(items);
      });
    };

    // Stale-while-revalidate: emit the cached list synchronously so the page can
    // render (and drop its loader) instantly, then refetch and update silently.
    const cached = readCache<InventoryItem[]>(invCacheKey(branchId));
    if (cached && cached.length) {
      registerItems(cached, branchId);
      callback(cached);
    }

    // Initial fetch
    refetch();

    // Menu edits happen on commissary rows and stock writes on branch rows, so
    // watch the whole inventory_items table + per-branch stock + categories.
    const channel = supabase
      .channel(`inventory-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items' },
        refetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_item_categories' },
        refetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branch_item_stock', filter: `branch_id=eq.${branchId}` },
        refetch
      );

    channel.subscribe();

    return () => {
      activeCallbacks.get(branchId)?.delete(callback);
      channel.unsubscribe();
    };
  },
};
