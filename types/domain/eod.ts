// Domain entities for EOD (End-of-Day) Stock Auditing

export type EodSessionStatus = 'draft' | 'submitted';
export type EodLockStatus = 'locked' | 'submitted';
export type EodResolution = 'force_carryover' | 'force_wastage';

export interface EodSession {
  id: string;
  branch_id: string;
  audit_date: string; // 'YYYY-MM-DD'
  status: EodSessionStatus;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface EodItemLock {
  id: string;
  session_id: string;
  branch_id: string;
  audit_date: string; // 'YYYY-MM-DD'
  item_id: string | null;
  item_name: string;
  expected_stock: number;
  locked_stock: number;
  discrepancy: number; // generated: locked_stock - expected_stock
  status: EodLockStatus;
  resolution: EodResolution | null;
  resolution_reason: string | null;
  locked_by: string | null;
  locked_at: string;
  created_at: string;
}

export interface CreateEodItemLockData {
  session_id: string;
  branch_id: string;
  audit_date: string;
  item_id: string | null;
  item_name: string;
  expected_stock: number;
  locked_stock: number;
  resolution?: EodResolution;
  resolution_reason?: string;
  locked_by: string | null;
}

export interface UpdateEodItemLockData {
  expected_stock?: number;
  locked_stock?: number;
  resolution?: EodResolution | null;
  resolution_reason?: string | null;
  status?: EodLockStatus;
}

// Aggregated summary for the sales page metrics
export interface EodDailySummary {
  date: string; // 'YYYY-MM-DD'
  items_locked: number;
  items_with_discrepancy: number;
  total_discrepancy_units: number; // sum of abs(discrepancy) across all locks
  session_status: EodSessionStatus | null;
}
