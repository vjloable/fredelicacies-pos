import { shiftRepository } from '@/lib/repositories/shiftRepository';
import { safeDropRepository } from '@/lib/repositories/safeDropRepository';
import { writeOffRepository } from '@/lib/repositories/writeOffRepository';
import { logActivity } from '@/services/activityLogService';
import { log } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import type { Shift, ShiftReportData } from '@/types/domain/shift';

export async function openShift(
  branchId: string,
  cashierId: string,
  beginningCash: number,
): Promise<{ shift: Shift | null; error: any }> {
  log.info('Opening shift', { branchId, cashierId, beginningCash });

  const { shift: existing } = await shiftRepository.getOpenShift(branchId, cashierId);
  if (existing) {
    return { shift: existing, error: { message: 'You already have an open shift at this branch.' } };
  }

  const { shift, error } = await shiftRepository.create({
    branch_id: branchId,
    cashier_id: cashierId,
    beginning_cash: beginningCash,
  });

  if (error || !shift) {
    log.error('Failed to open shift', new Error(error?.message || 'Unknown'), { branchId, cashierId });
    return { shift: null, error };
  }

  log.info('Shift opened', { branchId, cashierId, shiftId: shift.id });

  void logActivity({
    branchId,
    userId: cashierId,
    action: 'shift_opened',
    entityType: 'shift',
    entityId: shift.id,
    details: { beginning_cash: beginningCash },
  });

  return { shift, error: null };
}

export async function getActiveShift(
  branchId: string,
  cashierId: string,
): Promise<{ shift: Shift | null; error: any }> {
  return shiftRepository.getOpenShift(branchId, cashierId);
}

export async function closeShift(
  shiftId: string,
  branchId: string,
  cashierId: string,
  actualCash: number,
  remarks?: string,
): Promise<{ shift: Shift | null; reportData: ShiftReportData | null; error: any }> {
  log.info('Closing shift', { shiftId, branchId, cashierId, actualCash });

  const { shift: currentShift, error: fetchError } = await shiftRepository.getById(shiftId);
  if (fetchError || !currentShift) {
    return { shift: null, reportData: null, error: fetchError || { message: 'Shift not found' } };
  }

  const reportData = await computeShiftReportData(currentShift, branchId, actualCash, remarks || null);

  const { shift, error } = await shiftRepository.close(shiftId, {
    actual_cash: actualCash,
    expected_cash: reportData.cashMonitoring.expectedCash,
    over_short: reportData.cashMonitoring.overShort,
    remarks,
  });

  if (error || !shift) {
    log.error('Failed to close shift', new Error(error?.message || 'Unknown'), { shiftId });
    return { shift: null, reportData: null, error };
  }

  log.info('Shift closed', {
    shiftId, branchId, cashierId,
    expectedCash: reportData.cashMonitoring.expectedCash,
    actualCash,
    overShort: reportData.cashMonitoring.overShort,
  });

  void logActivity({
    branchId,
    userId: cashierId,
    action: 'shift_closed',
    entityType: 'shift',
    entityId: shiftId,
    details: {
      expected_cash: reportData.cashMonitoring.expectedCash,
      actual_cash: actualCash,
      over_short: reportData.cashMonitoring.overShort,
      remarks,
    },
  });

  return { shift, reportData, error: null };
}

export async function getShiftsByBranch(
  branchId: string,
  options?: { startDate?: string; endDate?: string; status?: 'open' | 'closed' }
): Promise<{ shifts: Shift[]; error: any }> {
  return shiftRepository.getByBranch(branchId, options);
}

export async function computeShiftReportData(
  shift: Shift,
  branchId: string,
  actualCash: number,
  remarks: string | null,
): Promise<ShiftReportData> {
  const openedAt = shift.opened_at;
  const closedAt = new Date().toISOString();

  // Fetch all orders during the shift time range
  const { data: orders } = await supabase
    .from('orders')
    .select('*, discounts(type, name)')
    .eq('branch_id', branchId)
    .gte('created_at', openedAt)
    .lte('created_at', closedAt);

  const allOrders = orders || [];
  const completedOrders = allOrders.filter((o: any) => o.status === 'completed');
  const voidedOrders = allOrders.filter((o: any) => o.status === 'voided');
  const refundedOrders = allOrders.filter((o: any) => o.status === 'refunded');

  // Sales by payment method (completed only)
  let cashSales = 0, gcashSales = 0, grabSales = 0, debitCreditSales = 0, employeeChargeSales = 0;
  let splitCashPortion = 0;

  for (const o of completedOrders) {
    const pm = o.payment_method;
    if (pm === 'cash') cashSales += o.total;
    else if (pm === 'gcash') gcashSales += o.total;
    else if (pm === 'grab') grabSales += o.total;
    else if (pm === 'debit_credit') debitCreditSales += o.total;
    else if (pm === 'employee_charge') employeeChargeSales += o.total;
    else if (pm === 'split' && o.payment_details) {
      const d = o.payment_details;
      if (d.split_method_1 === 'cash') splitCashPortion += parseFloat(d.split_amount_1 || '0');
      if (d.split_method_2 === 'cash') splitCashPortion += parseFloat(d.split_amount_2 || '0');
      // Count non-cash split portions to their respective methods
      if (d.split_method_1 === 'gcash') gcashSales += parseFloat(d.split_amount_1 || '0');
      if (d.split_method_2 === 'gcash') gcashSales += parseFloat(d.split_amount_2 || '0');
      if (d.split_method_1 === 'grab') grabSales += parseFloat(d.split_amount_1 || '0');
      if (d.split_method_2 === 'grab') grabSales += parseFloat(d.split_amount_2 || '0');
      if (d.split_method_1 === 'debit_credit') debitCreditSales += parseFloat(d.split_amount_1 || '0');
      if (d.split_method_2 === 'debit_credit') debitCreditSales += parseFloat(d.split_amount_2 || '0');
    }
  }

  // Discounts by type
  let employeeDiscountCount = 0, employeeDiscountTotal = 0;
  let scPwdDiscountCount = 0, scPwdDiscountTotal = 0;
  for (const order of completedOrders) {
    if (order.discount_amount > 0 && order.discounts) {
      const discType = order.discounts.type;
      const discName = (order.discounts.name || '').toLowerCase();
      if (discType === 'sc_pwd') {
        scPwdDiscountCount++;
        scPwdDiscountTotal += order.discount_amount;
      } else if (discName.includes('employee')) {
        employeeDiscountCount++;
        employeeDiscountTotal += order.discount_amount;
      }
    }
  }

  // Cash refunds
  const cashRefunds = refundedOrders
    .filter((o: any) => o.payment_method === 'cash')
    .reduce((s: number, o: any) => s + o.total, 0);

  // Safe drops
  const { drops } = await safeDropRepository.getByShift(shift.id);
  const safeDropTotal = drops.reduce((s, d) => s + d.amount, 0);

  // Write-offs
  const { writeOffs } = await writeOffRepository.getByShift(shift.id);
  const freeWriteOffs = writeOffs.filter(w => w.type === 'free');
  const nearExpiryWriteOffs = writeOffs.filter(w => w.type === 'near_expiry');

  // Expected cash
  const totalCashInflow = cashSales + splitCashPortion;
  const expectedCash = shift.beginning_cash + totalCashInflow - cashRefunds - safeDropTotal;
  const overShort = actualCash - expectedCash;

  // Fetch branch and cashier names
  const { data: branch } = await supabase
    .from('branches')
    .select('name')
    .eq('id', branchId)
    .single();

  const { data: cashierProfile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', shift.cashier_id)
    .single();

  return {
    shiftDetails: {
      cashierName: cashierProfile?.name || 'Unknown',
      beginningCash: shift.beginning_cash,
      openedAt,
      closedAt,
    },
    salesSummary: {
      totalCash: cashSales + splitCashPortion,
      totalGCash: gcashSales,
      totalGrab: grabSales,
      totalDebitCredit: debitCreditSales,
      totalEmployeeCharge: employeeChargeSales,
      totalSales: cashSales + splitCashPortion + gcashSales + grabSales + debitCreditSales + employeeChargeSales,
    },
    adjustments: {
      voidCount: voidedOrders.length,
      voidTotal: voidedOrders.reduce((s: number, o: any) => s + o.total, 0),
      refundCount: refundedOrders.length,
      refundTotal: refundedOrders.reduce((s: number, o: any) => s + o.total, 0),
      employeeDiscountCount,
      employeeDiscountTotal,
      scPwdDiscountCount,
      scPwdDiscountTotal,
      freeCount: freeWriteOffs.length,
      freeTotal: freeWriteOffs.reduce((s, w) => s + w.amount, 0),
      nearExpiryCount: nearExpiryWriteOffs.length,
      nearExpiryTotal: nearExpiryWriteOffs.reduce((s, w) => s + w.amount, 0),
    },
    cashMonitoring: {
      beginningCash: shift.beginning_cash,
      cashSales: totalCashInflow,
      cashRefunds,
      safeDrops: safeDropTotal,
      payout: 0,
      expectedCash,
      actualCash,
      overShort,
    },
    others: {
      safeDropTotal,
      safeDropCount: drops.length,
      payoutTotal: 0,
      transactionCount: completedOrders.length,
      remarks,
    },
    storeName: 'FREDELECACIES',
    branchName: branch?.name || '',
  };
}
