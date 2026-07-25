// Assorted Kakanin Repository - per-branch config data access
import { supabase } from '@/lib/supabase';
import type { AssortedKakaninConfig } from '@/types/domain/assortedKakanin';

const EMPTY = (branchId: string): AssortedKakaninConfig => ({
  branch_id: branchId,
  container_item_ids: [],
  kakanin_item_ids: [],
});

const rowToConfig = (row: Record<string, any>): AssortedKakaninConfig => ({
  branch_id: row.branch_id,
  container_item_ids: row.container_item_ids ?? [],
  kakanin_item_ids: row.kakanin_item_ids ?? [],
  updated_at: row.updated_at,
});

export const assortedKakaninRepository = {
  // Get the config for a branch. Returns an empty config when none is saved yet.
  async get(branchId: string): Promise<{ config: AssortedKakaninConfig; error: any }> {
    const { data, error } = await supabase
      .from('assorted_kakanin_config')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) return { config: EMPTY(branchId), error };
    return { config: data ? rowToConfig(data) : EMPTY(branchId), error: null };
  },

  // Create or replace the config for a branch.
  async upsert(
    branchId: string,
    containerItemIds: string[],
    kakaninItemIds: string[]
  ): Promise<{ config: AssortedKakaninConfig | null; error: any }> {
    const { data, error } = await supabase
      .from('assorted_kakanin_config')
      .upsert(
        {
          branch_id: branchId,
          container_item_ids: containerItemIds,
          kakanin_item_ids: kakaninItemIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id' }
      )
      .select()
      .single();

    return { config: data ? rowToConfig(data) : null, error };
  },

  // Subscribe to config changes for a branch.
  subscribe(branchId: string, callback: (config: AssortedKakaninConfig) => void) {
    this.get(branchId).then(({ config }) => callback(config));

    const channel = supabase
      .channel(`assorted-kakanin-config-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assorted_kakanin_config',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.get(branchId).then(({ config }) => callback(config));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
