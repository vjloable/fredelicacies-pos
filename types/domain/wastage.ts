// Domain entity for WastageLog
export interface WastageLog {
  id: string;
  branch_id: string;
  item_id: string | null;
  item_name: string;
  quantity_wasted: number;
  cost_per_unit: number;
  total_cost: number;
  recorded_by: string | null;
  wastage_date: string; // 'YYYY-MM-DD'
  created_at: string;
}

export interface CreateWastageData {
  item_id?: string;
  item_name: string;
  quantity_wasted: number;
  cost_per_unit: number;
  wastage_date?: string; // defaults to today
}

export interface WastageDailySummary {
  date: string; // 'YYYY-MM-DD'
  total_cost: number;
  total_quantity: number;
}

export interface WastageItemSummary {
  item_id: string | null;
  item_name: string;
  total_cost: number;
  total_quantity: number;
}
