'use client';

import { useState } from 'react';
import { useShift } from '@/contexts/ShiftContext';
import { useBluetoothPrinter } from '@/contexts/BluetoothContext';
import { formatCurrency } from '@/lib/currency_formatter';
import { formatShiftReportESC } from '@/lib/esc_formatter';

function ReportRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-secondary/70">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold' : 'font-medium'} ${color || 'text-secondary'}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-2 bg-gray-50 border-y border-gray-100">
      <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">{title}</h4>
    </div>
  );
}

export default function ShiftReportModal() {
  const shift = useShift();
  const { printReceipt } = useBluetoothPrinter();
  const [printing, setPrinting] = useState(false);

  if (!shift.showShiftReport || !shift.shiftReportData) return null;

  const r = shift.shiftReportData;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const escData = await formatShiftReportESC(r);
      await printReceipt(escData);
    } catch (err) {
      console.error('Failed to print shift report:', err);
    } finally {
      setPrinting(false);
    }
  };

  const openedAt = new Date(r.shiftDetails.openedAt);
  const closedAt = new Date(r.shiftDetails.closedAt);
  const elapsed = Math.floor((closedAt.getTime() - openedAt.getTime()) / 60000);
  const hours = Math.floor(elapsed / 60);
  const mins = elapsed % 60;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const overShortColor = r.cashMonitoring.overShort >= 0 ? 'text-success' : 'text-error';
  const overShortLabel = r.cashMonitoring.overShort >= 0 ? 'Over' : 'Short';
  const overShortSign = r.cashMonitoring.overShort >= 0 ? '+' : '';

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={() => shift.dismissShiftReport()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-success/10 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-secondary">Shift Report</h3>
              <p className="text-xs text-secondary/50">{r.storeName} — {r.branchName}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Shift Details */}
          <SectionHeader title="Shift Details" />
          <div className="px-5 py-2">
            <ReportRow label="Opened by" value={r.shiftDetails.cashierName} bold />
            <ReportRow label="Date" value={formatDate(r.shiftDetails.openedAt)} />
            <ReportRow label="Opened" value={formatTime(r.shiftDetails.openedAt)} />
            <ReportRow label="Closed" value={formatTime(r.shiftDetails.closedAt)} />
            <ReportRow label="Duration" value={`${hours}h ${mins}m`} />
          </div>

          {/* Sales Summary */}
          <SectionHeader title="Sales Summary" />
          <div className="px-5 py-2">
            <ReportRow label="Cash" value={formatCurrency(r.salesSummary.totalCash)} />
            <ReportRow label="GCash" value={formatCurrency(r.salesSummary.totalGCash)} />
            <ReportRow label="Grab" value={formatCurrency(r.salesSummary.totalGrab)} />
            <ReportRow label="Debit/Credit" value={formatCurrency(r.salesSummary.totalDebitCredit)} />
            <ReportRow label="Employee Charge" value={formatCurrency(r.salesSummary.totalEmployeeCharge)} />
            <div className="border-t border-gray-100 mt-1 pt-1">
              <ReportRow label="Total Sales" value={formatCurrency(r.salesSummary.totalSales)} bold />
            </div>
          </div>

          {/* Adjustments */}
          <SectionHeader title="Adjustments" />
          <div className="px-5 py-2">
            {r.adjustments.voidCount > 0 && (
              <ReportRow label={`Voids (${r.adjustments.voidCount})`} value={formatCurrency(r.adjustments.voidTotal)} color="text-error" />
            )}
            {r.adjustments.refundCount > 0 && (
              <ReportRow label={`Refunds (${r.adjustments.refundCount})`} value={formatCurrency(r.adjustments.refundTotal)} color="text-error" />
            )}
            {r.adjustments.employeeDiscountCount > 0 && (
              <ReportRow label={`Employee Discount (${r.adjustments.employeeDiscountCount})`} value={formatCurrency(r.adjustments.employeeDiscountTotal)} />
            )}
            {r.adjustments.scPwdDiscountCount > 0 && (
              <ReportRow label={`SC/PWD Discount (${r.adjustments.scPwdDiscountCount})`} value={formatCurrency(r.adjustments.scPwdDiscountTotal)} />
            )}
            {r.adjustments.freeCount > 0 && (
              <ReportRow label={`Free Items (${r.adjustments.freeCount})`} value={formatCurrency(r.adjustments.freeTotal)} />
            )}
            {r.adjustments.nearExpiryCount > 0 && (
              <ReportRow label={`Near Expiry (${r.adjustments.nearExpiryCount})`} value={formatCurrency(r.adjustments.nearExpiryTotal)} />
            )}
            {r.adjustments.voidCount === 0 && r.adjustments.refundCount === 0 &&
             r.adjustments.employeeDiscountCount === 0 && r.adjustments.scPwdDiscountCount === 0 &&
             r.adjustments.freeCount === 0 && r.adjustments.nearExpiryCount === 0 && (
              <p className="text-xs text-secondary/40 py-1">No adjustments this shift</p>
            )}
          </div>

          {/* Cash Monitoring */}
          <SectionHeader title="Cash Monitoring" />
          <div className="px-5 py-2">
            <ReportRow label="Beginning Cash" value={formatCurrency(r.cashMonitoring.beginningCash)} />
            <ReportRow label="+ Cash Sales" value={formatCurrency(r.cashMonitoring.cashSales)} />
            {r.cashMonitoring.cashRefunds > 0 && (
              <ReportRow label="- Cash Refunds" value={formatCurrency(r.cashMonitoring.cashRefunds)} color="text-error" />
            )}
            {r.cashMonitoring.safeDrops > 0 && (
              <ReportRow label="- Safe Drops" value={formatCurrency(r.cashMonitoring.safeDrops)} />
            )}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <ReportRow label="Expected Cash" value={formatCurrency(r.cashMonitoring.expectedCash)} bold />
              <ReportRow label="Actual Cash" value={formatCurrency(r.cashMonitoring.actualCash)} bold />
            </div>
            <div className="border-t border-dashed border-gray-200 mt-1 pt-1">
              <ReportRow
                label={overShortLabel}
                value={`${overShortSign}${formatCurrency(Math.abs(r.cashMonitoring.overShort))}`}
                bold
                color={overShortColor}
              />
            </div>
          </div>

          {/* Others */}
          {(r.others.transactionCount > 0 || r.others.remarks) && (
            <>
              <SectionHeader title="Others" />
              <div className="px-5 py-2">
                <ReportRow label="Transactions" value={r.others.transactionCount.toString()} />
                {r.others.safeDropCount > 0 && (
                  <ReportRow label={`Safe Drops (${r.others.safeDropCount})`} value={formatCurrency(r.others.safeDropTotal)} />
                )}
                {r.others.remarks && (
                  <div className="mt-1">
                    <p className="text-xs text-secondary/50">Remarks</p>
                    <p className="text-xs text-secondary mt-0.5">{r.others.remarks}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex-1 py-2.5 bg-accent hover:bg-accent/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {printing ? 'Printing...' : 'Print'}
          </button>
          <button
            onClick={() => shift.dismissShiftReport()}
            className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
