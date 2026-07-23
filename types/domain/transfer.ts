// Domain entity for inventory transfers between branches.
// See plan: /Users/vincejaphethloable/.claude/plans/help-plan-out-the-eager-nest.md

export type TransferDirection = 'push' | 'pull';
export type TransferStatus = 'sent' | 'received' | 'cancelled';

export interface Transfer {
  id: string;
  transfer_number: string;
  source_branch_id: string;
  destination_branch_id: string;
  direction: TransferDirection;
  status: TransferStatus;
  created_by: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  received_at: string | null;
  received_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancel_type: 'requester' | 'source' | null;
  fulfill_note: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  source_item_id: string | null;
  destination_item_id: string | null;
  item_name: string;
  item_cost: number | null;
  item_price: number | null;
  category_names: string[] | null;
  quantity_sent: number;
  quantity_received: number | null;
}

export interface TransferWithItems extends Transfer {
  items: TransferItem[];
  source_branch_name?: string;
  destination_branch_name?: string;
  created_by_name?: string;
}

// Input for creating a push transfer (source-initiated).
export interface CreatePushTransferData {
  source_branch_id: string;
  destination_branch_id: string;
  note?: string;
  items: Array<{
    source_item_id: string;
    quantity_sent: number;
  }>;
}

// Input for creating a pull request (destination-initiated).
// Lines reference SOURCE inventory items because the destination is requesting from source.
export interface CreatePullRequestData {
  source_branch_id: string;
  destination_branch_id: string;
  note?: string;
  items: Array<{
    source_item_id: string;
    quantity_sent: number;
  }>;
}

// Input for receive_settle RPC: per-line received counts + resolved destination_item_id.
export interface SettleLineCount {
  transfer_item_id: string;
  quantity_received: number;
  destination_item_id: string;
}
