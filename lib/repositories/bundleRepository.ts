// Bundle Repository - Handles bundle data access with components
import { supabase } from '@/lib/supabase';
import type { Bundle, BundleComponent, BundleWithComponents, CreateBundleData, UpdateBundleData } from '@/types/domain/bundle';

export const bundleRepository = {
  // Create a new bundle
  async create(branchId: string, data: CreateBundleData): Promise<{ bundle: Bundle | null; error: any }> {
    const { data: bundle, error } = await supabase
      .from('bundles')
      .insert({
        branch_id: branchId,
        name: data.name,
        price: data.price,
        description: data.description || null,
        img_url: data.img_url || null,
        is_predefined: data.is_predefined || false,
        status: data.status || 'active',
      })
      .select()
      .single();

    return { bundle, error };
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
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    return { bundles: data || [], error };
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

    // Then get components for all bundles
    const { data: components, error: componentsError } = await supabase
      .from('bundle_components')
      .select(`
        *,
        inventory_items (*)
      `)
      .in('bundle_id', bundles.map(b => b.id));

    if (componentsError) {
      return { bundles: [], error: componentsError };
    }

    // Merge bundles with their components
    const bundlesWithComponents: BundleWithComponents[] = bundles.map(bundle => ({
      ...bundle,
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
    }));

    return { bundles: bundlesWithComponents, error: null };
  },

  // Get single bundle by ID
  async getById(id: string): Promise<{ bundle: Bundle | null; error: any }> {
    const { data, error } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single();

    return { bundle: data, error };
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

    const { data: components, error: componentsError } = await supabase
      .from('bundle_components')
      .select(`
        *,
        inventory_items (*)
      `)
      .eq('bundle_id', id);

    if (componentsError) {
      return { bundle: null, error: componentsError };
    }

    const bundleWithComponents: BundleWithComponents = {
      ...bundle,
      components: (components || []).map(c => ({
        id: c.id,
        bundle_id: c.bundle_id,
        inventory_item_id: c.inventory_item_id,
        quantity: c.quantity,
        created_at: c.created_at,
        inventory_item: c.inventory_items,
      })),
    };

    return { bundle: bundleWithComponents, error: null };
  },

  // Update bundle
  async update(id: string, data: UpdateBundleData): Promise<{ bundle: Bundle | null; error: any }> {
    const { data: bundle, error } = await supabase
      .from('bundles')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    return { bundle, error };
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

  // Subscribe to bundle changes for a branch
  subscribe(branchId: string, callback: (bundles: BundleWithComponents[]) => void) {
    // Initial fetch
    this.getByBranchWithComponents(branchId).then(({ bundles }) => callback(bundles));

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
          this.getByBranchWithComponents(branchId).then(({ bundles }) => callback(bundles));
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
          this.getByBranchWithComponents(branchId).then(({ bundles }) => callback(bundles));
        }
      )
      .subscribe();

    return () => {
      bundleChannel.unsubscribe();
    };
  },
};
