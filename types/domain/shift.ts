// Domain entity for Shift

export interface Shift {
  id: string;
  branch_id: string;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  beginning_cash: number;
  actual_cash: number | null;
  expected_cash: number | null;
  over_short: number | null;
  remarks: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface CreateShiftData {
  branch_id: string;
  cashier_id: string;
  beginning_cash: number;
}

export interface CloseShiftData {
  actual_cash: number;
  expected_cash: number;
  over_short: number;
  remarks?: string;
}

export interface ShiftReportData {
  shiftDetails: {
    cashierName: string;
    beginningCash: number;
    openedAt: string;
    closedAt: string;
  };
  salesSummary: {
    totalCash: number;
    totalGCash: number;
    totalGrab: number;
    totalDebitCredit: number;
    totalEmployeeCharge: number;
    totalSales: number;
  };
  adjustments: {
    voidCount: number;
    voidTotal: number;
    refundCount: number;
    refundTotal: number;
    employeeDiscountCount: number;
    employeeDiscountTotal: number;
    scPwdDiscountCount: number;
    scPwdDiscountTotal: number;
    freeCount: number;
    freeTotal: number;
    nearExpiryCount: number;
    nearExpiryTotal: number;
  };
  cashMonitoring: {
    beginningCash: number;
    cashSales: number;
    cashRefunds: number;
    safeDrops: number;
    payout: number;
    expectedCash: number;
    actualCash: number;
    overShort: number;
  };
  others: {
    safeDropTotal: number;
    safeDropCount: number;
    payoutTotal: number;
    transactionCount: number;
    remarks: string | null;
  };
  storeName: string;
  branchName: string;
}
