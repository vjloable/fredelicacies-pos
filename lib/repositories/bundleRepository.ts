// Bundle Repository - Handles bundle data access with components
import { supabase } from '@/lib/supabase';
import type { Bundle, BundleAdditionalItem, BundleComponent, BundleWithComponents, CreateBundleData, UpdateBundleData } from '@/types/domain/bundle';

// Module-level callback registry for immediate post-mutation refresh
const activeCallbacks = new Map<string, Set<(bundles: BundleWithComponents[]) => void>>();
// Map bundleId → branchId so update/delete can find which branch to refresh
const bundleBranchIndex = new Map<string, string>();

function registerBundles(bundles: BundleWithComponents[], branchId: string) {
  bundles.forEach(bundle => { if (bundle.id) bundleBranchIndex.set(bundle.id, branchId); });
}

function mergeBundleCategoryIds(bundle: any, bundleCategories: any[]): any {
  const catIds = bundleCategories
    .filter(bc => bc.bundle_id === bundle.id)
    .map(bc => bc.category_id as string);
  return { ...bundle, category_ids: catIds };
}

export const bundleRepository = {
  // Create a new bundle
  async create(branchId: string, data: CreateBundleData): Promise<{ bundle: Bundle | null; error: any }> {
    const categoryIds = data.category_ids ?? (data.category_id ? [data.category_id] : []);
    const { data: bundle, error } = await supabase
      .from('bundles')
      .insert({
        branch_id: branchId,
        name: data.name,
        price: data.price,
        description: data.description || null,
        img_url: data.img_url || null,
        is_predefined: data.is_predefined || false,
        is_custom: data.is_custom || false,
        max_pieces: data.is_custom ? (data.max_pieces ?? null) : null,
        category_id: categoryIds[0] ?? null,
        status: data.status || 'active',
      })
      .select()
      .single();

    if (bundle && categoryIds.length > 0) {
      await supabase.from('bundle_categories').insert(
        categoryIds.map(catId => ({ bundle_id: bundle.id, category_id: catId }))
      );
    }

    return { bundle: bundle ? { ...bundle, category_ids: categoryIds } : null, error };
  },

  // Add components to a bundle
  async addComponents(bundleId: string, components: Array<{ inventoryItemId: string; quantity: number }>): Promise<{ error: any }> {
    const { error } = await supabase
      .from('bundle_components')
      .insert(
        components.map(c => ({
          bundle_id: bundleId,
          inventory_item_id: c.inventoryItemId,
          quantity: c.quantity,
        }))
      );

    return { error };
  },

  // Get all bundles for a branch (without components)
  async getByBranch(branchId: string): Promise<{ bundles: Bundle[]; error: any }> {
    const { data, error } = await supabase
      .from('bundles')
      .select('*, bundle_categories(category_id)')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    const bundles: Bundle[] = (data || []).map(({ bundle_categories: bc, ...bundle }) => ({
      ...bundle,
      category_ids: (bc || []).map((r: { category_id: string }) => r.category_id),
    }));

    return { bundles, error };
  },

  // Get all bundles with their components
  async getByBranchWithComponents(branchId: string): Promise<{ bundles: BundleWithComponents[]; error: any }> {
    // First get bundles
    const { data: bundles, error: bundlesError } = await supabase
      .from('bundles')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (bundlesError || !bundles) {
      return { bundles: [], error: bundlesError };
    }

    const bundleIds = bundles.map(b => b.id);

    // Fetch components, additional items, and category associations in parallel
    const [
      { data: components, error: componentsError },
      { data: additionalItems },
      { data: bundleCategories },
    ] = await Promise.all([
      supabase.from('bundle_components').select('*, inventory_items (*)').in('bundle_id', bundleIds),
      supabase.from('bundle_additional_items').select('*, inventory_items (*)').in('bundle_id', bundleIds),
      supabase.from('bundle_categories').select('bundle_id, category_id').in('bundle_id', bundleIds),
    ]);

    if (componentsError) {
      return { bundles: [], error: componentsError };
    }

    // Merge bundles with their components, additional items, and category_ids
    const bundlesWithComponents: BundleWithComponents[] = bundles.map(bundle => ({
      ...mergeBundleCategoryIds(bundle, bundleCategories || []),
      components: (components || [])
        .filter(c => c.bundle_id === bundle.id)
        .map(c => ({
          id: c.id,
          bundle_id: c.bundle_id,
          inventory_item_id: c.inventory_item_id,
          quantity: c.quantity,
          created_at: c.created_at,
          inventory_item: c.inventory_items,
        })),
      additional_items: (additionalItems || [])
        .filter(a => a.bundle_id === bundle.id)
        .map((a): BundleAdditionalItem => ({
          id: a.id,
          bundle_id: a.bundle_id,
          inventory_item_id: a.inventory_item_id,
          quantity: a.quantity,
          created_at: a.created_at,
          inventory_item: a.inventory_items,
        })),
    }));

    return { bundles: bundlesWithComponents, error: null };
  },

  // Get single bundle by ID
  async getById(id: string): Promise<{ bundle: Bundle | null; error: any }> {
    const { data, error } = await supabase
      .from('bundles')
      .select('*, bundle_categories(category_id)')
      .eq('id', id)
      .single();

    if (!data) return { bundle: null, error };
    const { bundle_categories: bc, ...bundle } = data;
    return {
      bundle: { ...bundle, category_ids: (bc || []).map((r: { category_id: string }) => r.category_id) },
      error,
    };
  },

  // Get single bundle with components
  async getByIdWithComponents(id: string): Promise<{ bundle: BundleWithComponents | null; error: any }> {
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single();

    if (bundleError || !bundle) {
      return { bundle: null, error: bundleError };
    }

    const [
      { data: components, error: componentsError },
      { data: additionalItems },
      { data: bundleCategories },
    ] = await Promise.all([
      supabase.from('bundle_components').select('*, inventory_items (*)').eq('bundle_id', id),
      supabase.from('bundle_additional_items').select('*, inventory_items (*)').eq('bundle_id', id),
      supabase.from('bundle_categories').select('bundle_id, category_id').eq('bundle_id', id),
    ]);

    if (componentsError) {
      return { bundle: null, error: componentsError };
    }

    const bundleWithComponents: BundleWithComponents = {
      ...bundle,
      category_ids: (bundleCategories || []).map((r: { category_id: string }) => r.category_id),
      components: (components || []).map(c => ({
        id: c.id,
        bundle_id: c.bundle_id,
        inventory_item_id: c.inventory_item_id,
        quantity: c.quantity,
        created_at: c.created_at,
        inventory_item: c.inventory_items,
      })),
      additional_items: (additionalItems || []).map((a): BundleAdditionalItem => ({
        id: a.id,
        bundle_id: a.bundle_id,
        inventory_item_id: a.inventory_item_id,
        quantity: a.quantity,
        created_at: a.created_at,
        inventory_item: a.inventory_items,
      })),
    };

    return { bundle: bundleWithComponents, error: null };
  },

  // Update bundle
  async update(id: string, data: UpdateBundleData): Promise<{ bundle: Bundle | null; error: any }> {
    const { category_ids, ...dbData } = data;

    // Keep category_id in sync with the first selected category
    if (category_ids !== undefined) {
      dbData.category_id = category_ids[0] ?? null;
    }

    const { data: bundle, error } = await supabase
      .from('bundles')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (bundle && category_ids !== undefined) {
      await supabase.from('bundle_categories').delete().eq('bundle_id', id);
      if (category_ids.length > 0) {
        await supabase.from('bundle_categories').insert(
          category_ids.map(catId => ({ bundle_id: id, category_id: catId }))
        );
      }
    }

    const resolvedCategoryIds = category_ids ?? [];
    return { bundle: bundle ? { ...bundle, category_ids: resolvedCategoryIds } : null, error };
  },

  // Delete bundle (components cascade delete via FK)
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('bundles')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Remove all components from a bundle
  async removeAllComponents(bundleId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('bundle_components')
      .delete()
      .eq('bundle_id', bundleId);

    return { error };
  },

  // Add additional items (fixed stock-deductible items) to a bundle
  async addAdditionalItems(bundleId: string, items: Array<{ inventoryItemId: string; quantity: number }>): Promise<{ error: any }> {
    if (items.length === 0) return { error: null };
    const { error } = await supabase
      .from('bundle_additional_items')
      .insert(items.map(i => ({
        bundle_id: bundleId,
        inventory_item_id: i.inventoryItemId,
        quantity: i.quantity,
      })));
    return { error };
  },

  // Remove all additional items from a bundle
  async removeAllAdditionalItems(bundleId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('bundle_additional_items')
      .delete()
      .eq('bundle_id', bundleId);
    return { error };
  },

  // Immediately notify all subscribers for a branch (call after mutations)
  async triggerRefresh(branchId: string): Promise<void> {
    const cbs = activeCallbacks.get(branchId);
    if (!cbs || cbs.size === 0) return;
    const { bundles } = await this.getByBranchWithComponents(branchId);
    registerBundles(bundles, branchId);
    cbs.forEach(cb => cb(bundles));
  },

  // Trigger refresh when only bundle ID is known (update/delete use case)
  async triggerRefreshByBundleId(bundleId: string): Promise<void> {
    const branchId = bundleBranchIndex.get(bundleId);
    if (branchId) await this.triggerRefresh(branchId);
  },

  // Subscribe to bundle changes for a branch
  subscribe(branchId: string, callback: (bundles: BundleWithComponents[]) => void) {
    // Register callback for immediate post-mutation refresh
    if (!activeCallbacks.has(branchId)) {
      activeCallbacks.set(branchId, new Set());
    }
    activeCallbacks.get(branchId)!.add(callback);

    // Initial fetch
    this.getByBranchWithComponents(branchId).then(({ bundles }) => {
      registerBundles(bundles, branchId);
      callback(bundles);
    });

    const bundleChannel = supabase
      .channel(`bundles-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bundles',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranchWithComponents(branchId).then(({ bundles }) => {
            registerBundles(bundles, branchId);
            callback(bundles);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bundle_components',
        },
        () => {
          this.getByBranchWithComponents(branchId).then(({ bundles }) => {
            registerBundles(bundles, branchId);
            callback(bundles);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bundle_additional_items',
        },
        () => {
          this.getByBranchWithComponents(branchId).then(({ bundles }) => {
            registerBundles(bundles, branchId);
            callback(bundles);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bundle_categories',
        },
        () => {
          this.getByBranchWithComponents(branchId).then(({ bundles }) => {
            registerBundles(bundles, branchId);
            callback(bundles);
          });
        }
      )
      .subscribe();

    return () => {
      activeCallbacks.get(branchId)?.delete(callback);
      bundleChannel.unsubscribe();
    };
  },
};
