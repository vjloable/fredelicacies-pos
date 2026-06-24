// Domain entity for Safe Drop

export interface SafeDrop {
  id: string;
  shift_id: string;
  branch_id: string;
  amount: number;
  cashier_id: string;
  receiver_id: string;
  created_at: string;
}

export interface CreateSafeDropData {
  shift_id: string;
  branch_id: string;
  amount: number;
  cashier_id: string;
  receiver_id: string;
}
