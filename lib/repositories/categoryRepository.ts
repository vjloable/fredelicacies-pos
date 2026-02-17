// Category Repository - Handles category data access
import { supabase } from '@/lib/supabase';
import type { Category, CreateCategoryData, UpdateCategoryData } from '@/types/domain/category';

// Module-level callback registry for immediate post-mutation refresh
const activeCallbacks = new Map<string, Set<(categories: Category[]) => void>>();
// Map categoryId → branchId so update/delete can find which branch to refresh
const categoryBranchIndex = new Map<string, string>();

function registerCategories(categories: Category[], branchId: string) {
  categories.forEach(cat => { if (cat.id) categoryBranchIndex.set(cat.id, branchId); });
}

export const categoryRepository = {
  // Create a new category
  async create(branchId: string, data: CreateCategoryData): Promise<{ category: Category | null; error: any }> {
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        branch_id: branchId,
        name: data.name,
        color: data.color,
      })
      .select()
      .single();

    return { category, error };
  },

  // Get all categories for a branch
  async getByBranch(branchId: string): Promise<{ categories: Category[]; error: any }> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    return { categories: data || [], error };
  },

  // Get single category by ID
  async getById(id: string): Promise<{ category: Category | null; error: any }> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    return { category: data, error };
  },

  // Update category
  async update(id: string, data: UpdateCategoryData): Promise<{ category: Category | null; error: any }> {
    const { data: category, error } = await supabase
      .from('categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    return { category, error };
  },

  // Delete category
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Immediately notify all subscribers for a branch (call after mutations)
  async triggerRefresh(branchId: string): Promise<void> {
    const cbs = activeCallbacks.get(branchId);
    if (!cbs || cbs.size === 0) return;
    const { categories } = await this.getByBranch(branchId);
    registerCategories(categories, branchId);
    cbs.forEach(cb => cb(categories));
  },

  // Trigger refresh when only category ID is known (update/delete use case)
  async triggerRefreshByCategoryId(categoryId: string): Promise<void> {
    const branchId = categoryBranchIndex.get(categoryId);
    if (branchId) await this.triggerRefresh(branchId);
  },

  // Subscribe to categories changes for a branch
  subscribe(branchId: string, callback: (categories: Category[]) => void) {
    // Register callback for immediate post-mutation refresh
    if (!activeCallbacks.has(branchId)) {
      activeCallbacks.set(branchId, new Set());
    }
    activeCallbacks.get(branchId)!.add(callback);

    // Initial fetch
    this.getByBranch(branchId).then(({ categories }) => {
      registerCategories(categories, branchId);
      callback(categories);
    });

    const channel = supabase
      .channel(`categories-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          // Refetch categories when any change occurs
          this.getByBranch(branchId).then(({ categories }) => {
            registerCategories(categories, branchId);
            callback(categories);
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
