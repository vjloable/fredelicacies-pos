// Bundle Group Repository - CRUD + realtime for bundle_groups, the parent
// "container" for single-type bundle variants. Individual variants are
// stored/managed entirely through bundleRepository — this repository only
// owns the group row (name/image/category) and grouping of already-fetched
// bundles by bundle_group_id.
import { supabase } from '@/lib/supabase';
import type { BundleGroup, BundleGroupWithVariants } from '@/types/domain/bundle';
import { bundleRepository } from './bundleRepository';
import { getCommissaryId } from './inventoryRepository';

// Bundle groups, like bundles, are only ever authored at the commissary and
// reflect directly to every branch at read time — resolve to the commissary
// branch, since that's where the actual group rows live.
async function resolveMenuBranchId(branchId: string): Promise<string> {
  const commissaryId = await getCommissaryId();
  return commissaryId ?? branchId;
}

const activeCallbacks = new Map<string, Set<(groups: BundleGroupWithVariants[]) => void>>();

function mergeGroupCategoryIds(group: any, groupCategories: any[]): any {
  const catIds = groupCategories
    .filter(gc => gc.bundle_group_id === group.id)
    .map(gc => gc.category_id as string);
  return { ...group, category_ids: catIds };
}

export const bundleGroupRepository = {
  async create(
    branchId: string,
    data: { name: string; description?: string; img_url?: string; category_id?: string | null; category_ids?: string[]; status?: 'active' | 'inactive' }
  ): Promise<{ group: BundleGroup | null; error: any }> {
    const categoryIds = data.category_ids ?? (data.category_id ? [data.category_id] : []);
    const { data: group, error } = await supabase
      .from('bundle_groups')
      .insert({
        branch_id: branchId,
        name: data.name,
        description: data.description || null,
        img_url: data.img_url || null,
        category_id: categoryIds[0] ?? null,
        status: data.status || 'active',
      })
      .select()
      .single();

    if (group && categoryIds.length > 0) {
      await supabase.from('bundle_group_categories').insert(
        categoryIds.map(catId => ({ bundle_group_id: group.id, category_id: catId }))
      );
    }

    return { group: group ? { ...group, category_ids: categoryIds } : null, error };
  },

  async update(
    id: string,
    data: { name?: string; description?: string; img_url?: string; category_id?: string | null; category_ids?: string[]; status?: 'active' | 'inactive' }
  ): Promise<{ group: BundleGroup | null; error: any }> {
    const { category_ids, ...dbData } = data;
    if (category_ids !== undefined) {
      dbData.category_id = category_ids[0] ?? null;
    }

    const { data: group, error } = await supabase
      .from('bundle_groups')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (group && category_ids !== undefined) {
      await supabase.from('bundle_group_categories').delete().eq('bundle_group_id', id);
      if (category_ids.length > 0) {
        await supabase.from('bundle_group_categories').insert(
          category_ids.map(catId => ({ bundle_group_id: id, category_id: catId }))
        );
      }
    }

    return { group: group ? { ...group, category_ids: category_ids ?? [] } : null, error };
  },

  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase.from('bundle_groups').delete().eq('id', id);
    return { error };
  },

  // Fetches all groups for a branch, each populated with its variant bundles
  // (reusing bundleRepository's already-joined components/additional_items fetch).
  async getByBranchWithVariants(branchId: string): Promise<{ groups: BundleGroupWithVariants[]; error: any }> {
    const menuBranchId = await resolveMenuBranchId(branchId);
    const [
      { data: groups, error: groupsError },
      { data: groupCategories },
      { bundles, error: bundlesError },
    ] = await Promise.all([
      supabase.from('bundle_groups').select('*').eq('branch_id', menuBranchId).order('name', { ascending: true }),
      supabase.from('bundle_group_categories').select('bundle_group_id, category_id'),
      bundleRepository.getByBranchWithComponents(branchId),
    ]);

    if (groupsError || !groups) return { groups: [], error: groupsError };
    if (bundlesError) return { groups: [], error: bundlesError };

    const result: BundleGroupWithVariants[] = groups.map(group => ({
      ...mergeGroupCategoryIds(group, groupCategories || []),
      variants: bundles.filter(b => b.bundle_group_id === group.id),
    }));

    return { groups: result, error: null };
  },

  async triggerRefresh(branchId: string): Promise<void> {
    const cbs = activeCallbacks.get(branchId);
    if (!cbs || cbs.size === 0) return;
    const { groups } = await this.getByBranchWithVariants(branchId);
    cbs.forEach(cb => cb(groups));
  },

  subscribe(branchId: string, callback: (groups: BundleGroupWithVariants[]) => void) {
    if (!activeCallbacks.has(branchId)) {
      activeCallbacks.set(branchId, new Set());
    }
    activeCallbacks.get(branchId)!.add(callback);

    this.getByBranchWithVariants(branchId).then(({ groups }) => callback(groups));

    const refetch = () => {
      this.getByBranchWithVariants(branchId).then(({ groups }) => callback(groups));
    };

    // Groups (like bundles) live on the commissary branch regardless of which
    // branch is watching, so listen unfiltered rather than by this branch's id.
    const channel = supabase
      .channel(`bundle-groups-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_groups' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_group_categories' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bundles' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_components' }, refetch)
      .subscribe();

    return () => {
      activeCallbacks.get(branchId)?.delete(callback);
      channel.unsubscribe();
    };
  },
};
