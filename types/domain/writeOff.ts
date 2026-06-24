// Domain entity for Write-Off (Free / Near Expiry)

export type WriteOffType = 'free' | 'near_expiry';

export interface WriteOff {
  id: string;
  shift_id: string | null;
  branch_id: string;
  type: WriteOffType;
  item_id: string | null;
  item_name: string;
  quantity: number;
  amount: number;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateWriteOffData {
  shift_id?: string;
  branch_id: string;
  type: WriteOffType;
  item_id?: string;
  item_name: string;
  quantity: number;
  amount: number;
  reason?: string;
  created_by: string;
}
