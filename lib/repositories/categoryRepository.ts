// Category Repository - Handles category data access
import { supabase } from '@/lib/supabase';
import type { Category, CreateCategoryData, UpdateCategoryData } from '@/types/domain/category';
import { readCache, writeCache } from '@/lib/branchCache';

// Persistent cache key for a branch's category list (stale-while-revalidate).
// Keyed by the requested branch id (what the page subscribes with), not the
// resolved commissary source, so hydration matches the caller.
const catCacheKey = (branchId: string) => `cat:${branchId}`;

// Module-level callback registry for immediate post-mutation refresh
const activeCallbacks = new Map<string, Set<(categories: Category[]) => void>>();
// Map categoryId → branchId so update/delete can find which branch to refresh
const categoryBranchIndex = new Map<string, string>();

function registerCategories(categories: Category[], branchId: string) {
  categories.forEach(cat => { if (cat.id) categoryBranchIndex.set(cat.id, branchId); });
}

// ─── Centralized menu ────────────────────────────────────────────────────────
// Categories are part of the menu, so — like inventory items — a non-commissary
// branch reads the COMMISSARY's categories, not its own (it has none). Memoized
// lookup of the single commissary branch id (mirrors inventoryRepository).
let commissaryIdCache: string | null | undefined;
async function getCommissaryId(): Promise<string | null> {
  // Never cache a null (commissary may be created after first load); only memoize a hit.
  if (commissaryIdCache) return commissaryIdCache;
  const { data } = await supabase
    .from('branches')
    .select('id')
    .eq('type', 'commissary')
    .limit(1)
    .maybeSingle();
  commissaryIdCache = data?.id ?? undefined;
  return commissaryIdCache ?? null;
}

// The branch whose categories a given branch should read (commissary for retail
// branches, itself for the commissary).
async function menuSourceBranchId(branchId: string): Promise<string> {
  const commissaryId = await getCommissaryId();
  return commissaryId && branchId !== commissaryId ? commissaryId : branchId;
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
        icon: data.icon ?? null,
      })
      .select()
      .single();

    return { category, error };
  },

  // Get all categories for a branch. Non-commissary branches read the commissary's
  // categories (the menu source); the commissary reads its own.
  async getByBranch(branchId: string): Promise<{ categories: Category[]; error: any }> {
    const sourceBranchId = await menuSourceBranchId(branchId);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('branch_id', sourceBranchId)
      .order('name', { ascending: true });

    const categories = data || [];
    if (!error) writeCache(catCacheKey(branchId), categories);
    return { categories, error };
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

    // Stale-while-revalidate: emit cached categories synchronously so the page
    // renders them immediately (no empty-state flash), then refetch and update
    // silently. Mirrors inventoryRepository.subscribe.
    const cached = readCache<Category[]>(catCacheKey(branchId));
    if (cached && cached.length) {
      registerCategories(cached, branchId);
      callback(cached);
    }

    // Initial fetch
    this.getByBranch(branchId).then(({ categories }) => {
      registerCategories(categories, branchId);
      callback(categories);
    });

    // No branch filter: a retail branch's categories live on the commissary row,
    // so we watch the whole categories table and let getByBranch route the refetch
    // to the correct (commissary) source. Matches the inventory subscription.
    const channel = supabase
      .channel(`categories-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
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
