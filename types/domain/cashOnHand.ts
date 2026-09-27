// Domain entity for Cash on Hand (editable per-branch, per-day ledger)

export type CashOnHandStatus = 'open' | 'ended';

export interface CashOnHand {
  id: string;
  branch_id: string;
  business_date: string; // 'YYYY-MM-DD'
  amount: number;
  status: CashOnHandStatus;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface CreateCashOnHandData {
  branch_id: string;
  business_date: string; // 'YYYY-MM-DD'
  amount: number;
  created_by: string | null;
}

export interface CashOnHandEdit {
  id: string;
  cash_on_hand_id: string;
  branch_id: string;
  old_amount: number;
  new_amount: number;
  edited_by: string | null;
  edited_at: string;
  // Resolved client-side for display (not a DB column)
  editor_name?: string | null;
}
