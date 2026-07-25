// Domain entity for Category
export interface Category {
  id: string;
  branch_id: string;
  name: string;
  color: string;
  icon?: string | null;
  is_hidden?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  color: string;
  icon?: string | null;
}

export interface UpdateCategoryData {
  name?: string;
  color?: string;
  icon?: string | null;
  is_hidden?: boolean;
}

// EOD policy per category per branch
export type EodPolicy = 'carryover' | 'destock_only';

export interface CategoryEodPolicy {
  id: string;
  branch_id: string;
  category_id: string;
  eod_policy: EodPolicy;
  created_at: string;
  updated_at: string;
}

export interface UpsertCategoryEodPolicyData {
  category_id: string;
  eod_policy: EodPolicy;
}
