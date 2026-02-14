// Domain entity for Discount
export interface Discount {
  id: string;
  branch_id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateDiscountData {
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  status?: 'active' | 'inactive';
}

export interface UpdateDiscountData {
  name?: string;
  type?: 'percentage' | 'fixed';
  value?: number;
  status?: 'active' | 'inactive';
}
