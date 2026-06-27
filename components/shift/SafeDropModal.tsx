'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useShift } from '@/contexts/ShiftContext';
import { useBranch } from '@/contexts/BranchContext';
import { workerService } from '@/services/workerService';
import type { Worker } from '@/services/workerService';
import { formatCurrency } from '@/lib/currency_formatter';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

interface SafeDropModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SafeDropModal({ isOpen, onClose }: SafeDropModalProps) {
  const shift = useShift();
  const { currentBranch } = useBranch();
  const [amount, setAmount] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [receiverSearch, setReceiverSearch] = useState('');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [clockedInIds, setClockedInIds] = useState<Set<string>>(new Set());
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !currentBranch) return;
    let cancelled = false;
    setLoadingWorkers(true);
    (async () => {
      try {
        const [allWorkers, clockedIn] = await Promise.all([
          workerService.getWorkersByBranch(currentBranch.id),
          workerService.getClockedInWorkers(currentBranch.id),
        ]);
        if (!cancelled) {
          setClockedInIds(new Set(clockedIn.map(w => w.id)));
          // Sort: clocked-in first, then alphabetical
          const sorted = [...allWorkers].sort((a, b) => {
            const aIn = clockedIn.some(c => c.id === a.id);
            const bIn = clockedIn.some(c => c.id === b.id);
            if (aIn && !bIn) return -1;
            if (!aIn && bIn) return 1;
            return a.name.localeCompare(b.name);
          });
          setWorkers(sorted);
        }
      } catch {
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setLoadingWorkers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, currentBranch]);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const canSubmit = parsedAmount > 0 && receiverId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    await shift.addSafeDrop(parsedAmount, receiverId);
    if (shift.error) {
      setError(shift.error);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setAmount('');
    setReceiverId('');
    onClose();
  };

  const handleAmountChange = (value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleClose = () => {
    setAmount('');
    setReceiverId('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={!submitting ? handleClose : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {submitting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Recording safe drop…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Safe Drop</h3>
                  <p className="text-xs text-secondary/50">Transfer cash from register to safe</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Running Total */}
              {shift.safeDrops.length > 0 && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-3">
                  <p className="text-xs text-success font-semibold">
                    This shift: {formatCurrency(shift.safeDropTotal)} ({shift.safeDrops.length} drop{shift.safeDrops.length !== 1 ? 's' : ''})
                  </p>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Amount</label>
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

              {/* Receiver */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Received by</label>
                {loadingWorkers ? (
                  <div className="flex items-center gap-2 py-3">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-secondary/50">Loading workers…</span>
                  </div>
                ) : workers.length === 0 ? (
                  <p className="text-xs text-secondary/50 py-2">No workers found in this branch</p>
                ) : (
                  <>
                    {workers.length > 6 && (
                      <input
                        type="text"
                        value={receiverSearch}
                        onChange={(e) => setReceiverSearch(e.target.value)}
                        placeholder="Search worker…"
                        className="w-full border border-secondary/20 rounded-xl h-9 px-3 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent mb-2"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                      {workers
                        .filter(w => !receiverSearch || w.name.toLowerCase().includes(receiverSearch.toLowerCase()))
                        .map((w) => {
                          const isClockedIn = clockedInIds.has(w.id);
                          return (
                            <button
                              key={w.id}
                              onClick={() => setReceiverId(w.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all flex items-center gap-1.5 ${
                                receiverId === w.id
                                  ? 'bg-accent text-primary ring-2 ring-accent'
                                  : 'bg-gray-50 text-secondary hover:bg-gray-100'
                              }`}
                            >
                              {isClockedIn && (
                                <span className="w-1.5 h-1.5 bg-success rounded-full shrink-0" title="Clocked in" />
                              )}
                              <span className="truncate">{w.name}</span>
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-error/5 border border-error/20 rounded-xl p-3">
                  <p className="text-xs text-error">{error}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 bg-accent hover:bg-accent/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Drop {parsedAmount > 0 ? formatCurrency(parsedAmount) : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
