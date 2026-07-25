// Food House Repository - per-branch config data access
import { supabase } from '@/lib/supabase';
import type { FoodHouseConfig } from '@/types/domain/foodHouse';

const EMPTY = (branchId: string): FoodHouseConfig => ({
  branch_id: branchId,
  dish_item_ids: [],
  container_item_ids: [],
});

const rowToConfig = (row: Record<string, any>): FoodHouseConfig => ({
  branch_id: row.branch_id,
  dish_item_ids: row.dish_item_ids ?? [],
  container_item_ids: row.container_item_ids ?? [],
  updated_at: row.updated_at,
});

export const foodHouseRepository = {
  async get(branchId: string): Promise<{ config: FoodHouseConfig; error: any }> {
    const { data, error } = await supabase
      .from('food_house_config')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) return { config: EMPTY(branchId), error };
    return { config: data ? rowToConfig(data) : EMPTY(branchId), error: null };
  },

  async upsert(
    branchId: string,
    dishItemIds: string[],
    containerItemIds: string[]
  ): Promise<{ config: FoodHouseConfig | null; error: any }> {
    const { data, error } = await supabase
      .from('food_house_config')
      .upsert(
        {
          branch_id: branchId,
          dish_item_ids: dishItemIds,
          container_item_ids: containerItemIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id' }
      )
      .select()
      .single();

    return { config: data ? rowToConfig(data) : null, error };
  },

  subscribe(branchId: string, callback: (config: FoodHouseConfig) => void) {
    this.get(branchId).then(({ config }) => callback(config));

    const channel = supabase
      .channel(`food-house-config-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_house_config', filter: `branch_id=eq.${branchId}` },
        () => { this.get(branchId).then(({ config }) => callback(config)); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  },
};
