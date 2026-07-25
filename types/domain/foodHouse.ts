// Domain entity for the per-branch Food House configuration.
// Curates which made-to-order dishes and which container sizes are offered when
// a cashier builds a Food House order in the store.
export interface FoodHouseConfig {
  branch_id: string;
  dish_item_ids: string[];
  container_item_ids: string[];
  updated_at?: string;
}
