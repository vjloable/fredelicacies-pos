// Domain entity for the per-branch Assorted Kakanin configuration.
// Curates which Container items and which Kakanin items are offered when a
// cashier builds an Assorted Kakanin order in the store.
export interface AssortedKakaninConfig {
  branch_id: string;
  container_item_ids: string[];
  kakanin_item_ids: string[];
  updated_at?: string;
}
