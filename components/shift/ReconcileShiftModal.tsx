'use client';

import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useShift } from '@/contexts/ShiftContext';
import { formatCurrency } from '@/lib/currency_formatter';

export default function ReconcileShiftModal() {
  const shift = useShift();
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!shift.pendingReconcileShift) return null;

  const parsedAmount = parseFloat(amount);
  const canSubmit = amount.trim() !== '' && !isNaN(parsedAmount) && parsedAmount >= 0;

  const handleAmountChange = (value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await shift.reconcileShift(parsedAmount, remarks.trim() || undefined);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
        {submitting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Saving…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-(--error)/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-(--error)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Confirm Previous Shift</h3>
                  <p className="text-xs text-secondary/50">This shift was auto-closed at midnight — count the drawer to confirm</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 rounded-full text-xs font-semibold text-accent">
                  Expected: {formatCurrency(shift.pendingReconcileShift.expected_cash ?? 0)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Actual Cash Counted</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50 font-semibold text-sm">₱</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00"
                    autoFocus
                    className="w-full border border-secondary/20 rounded-xl h-12 pl-7 pr-3 text-lg font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Remarks (optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Any notes about this shift..."
                  rows={2}
                  className="w-full border border-secondary/20 rounded-xl px-3 py-2 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>

              {shift.error && (
                <div className="bg-error/5 border border-error/20 rounded-xl p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-error">{shift.error}</p>
                </div>
              )}
            </div>

            {/* Actions — no cancel, cannot dismiss without input */}
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-2.5 bg-secondary hover:bg-secondary/80 disabled:bg-secondary/30 disabled:cursor-not-allowed text-primary rounded-xl text-xs font-semibold transition-all active:bg-secondary/70"
              >
                Confirm & Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
