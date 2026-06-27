'use client';

import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useShift } from '@/contexts/ShiftContext';
import { formatCurrency } from '@/lib/currency_formatter';

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000];

export default function OpenShiftModal() {
  const shift = useShift();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!shift.showOpenShiftModal) return null;

  const parsedAmount = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    await shift.openShift(parsedAmount);
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
      onClick={!submitting ? shift.dismissOpenShiftModal : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {submitting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Opening shift…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Open Shift</h3>
                  <p className="text-xs text-secondary/50">Enter your beginning cash to start</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Beginning Cash Input */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Beginning Cash</label>
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
                onClick={shift.dismissOpenShiftModal}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={parsedAmount < 0}
                className="flex-1 py-2.5 bg-accent hover:bg-accent/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Open Shift
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
