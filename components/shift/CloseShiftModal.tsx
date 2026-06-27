'use client';

import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useShift } from '@/contexts/ShiftContext';
import { formatCurrency } from '@/lib/currency_formatter';

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000];

export default function CloseShiftModal() {
  const shift = useShift();
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!shift.showCloseShiftModal || !shift.activeShift) return null;

  const parsedAmount = parseFloat(amount) || 0;

  const openedAt = new Date(shift.activeShift.opened_at);
  const elapsed = Math.floor((Date.now() - openedAt.getTime()) / 60000);
  const hours = Math.floor(elapsed / 60);
  const mins = elapsed % 60;

  const handleSubmit = async () => {
    setSubmitting(true);
    await shift.closeShift(parsedAmount, remarks.trim() || undefined);
    setSubmitting(false);
  };

  const handleAmountChange = (value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={!submitting ? shift.dismissCloseShiftModal : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {submitting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Closing shift…</p>
            <p className="text-xs text-secondary/50">Generating report</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Close Shift</h3>
                  <p className="text-xs text-secondary/50">Count and enter your actual cash on hand</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Shift Info */}
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/10 rounded-full text-xs font-semibold text-secondary">
                  {hours}h {mins}m
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 rounded-full text-xs font-semibold text-accent">
                  Beginning: {formatCurrency(shift.activeShift.beginning_cash)}
                </span>
                {shift.safeDropTotal > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success/10 rounded-full text-xs font-semibold text-success">
                    Drops: {formatCurrency(shift.safeDropTotal)}
                  </span>
                )}
              </div>

              {/* Actual Cash Input */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Actual Cash on Hand</label>
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

              {/* Quick Amount Pills */}
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((qa) => (
                  <button
                    key={qa}
                    onClick={() => setAmount(qa.toString())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                      parsedAmount === qa
                        ? 'bg-accent text-primary'
                        : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                    }`}
                  >
                    {formatCurrency(qa)}
                  </button>
                ))}
              </div>

              {/* Remarks */}
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

              {/* Error */}
              {shift.error && (
                <div className="bg-error/5 border border-error/20 rounded-xl p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-error">{shift.error}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={shift.dismissCloseShiftModal}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Close Shift
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
