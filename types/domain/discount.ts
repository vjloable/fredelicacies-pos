// Domain entity for Discount
export interface Discount {
  id: string;
  branch_id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'b1t1' | 'sc_pwd';
  value: number;
  status: 'active' | 'inactive';
  category_filter_mode: 'include' | 'exclude' | null;
  category_filter_ids: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDiscountData {
  name: string;
  type: 'percentage' | 'fixed' | 'b1t1' | 'sc_pwd';
  value: number;
  status?: 'active' | 'inactive';
  category_filter_mode?: 'include' | 'exclude' | null;
  category_filter_ids?: string[] | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateDiscountData {
  name?: string;
  type?: 'percentage' | 'fixed' | 'b1t1' | 'sc_pwd';
  value?: number;
  status?: 'active' | 'inactive';
  category_filter_mode?: 'include' | 'exclude' | null;
  category_filter_ids?: string[] | null;
  metadata?: Record<string, any> | null;
}
