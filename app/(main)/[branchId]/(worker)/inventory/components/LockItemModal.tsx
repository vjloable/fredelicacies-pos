'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { lockItem, unlockItem } from '@/services/eodService';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import type { EodItemLock } from '@/types/domain/eod';
import type { InventoryItem } from '@/types/domain/inventory';

interface LockItemModalProps {
  isOpen: boolean;
  item: InventoryItem & { id: string };
  existingLock: EodItemLock | null;
  onClose: () => void;
  onLocked: (lock: EodItemLock) => void;
  onUnlocked: () => void;
  onError: (msg: string) => void;
}

type DiscrepancyStep = 'idle' | 'resolve' | 'force_carryover_reason';

export default function LockItemModal({
  isOpen,
  item,
  existingLock,
  onClose,
  onLocked,
  onUnlocked,
  onError,
}: LockItemModalProps) {
  const { currentBranch } = useBranch();
  const { user } = useAuth();

  const [expectedInput, setExpectedInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [discrepancyStep, setDiscrepancyStep] = useState<DiscrepancyStep>('idle');
  const [carryoverReason, setCarryoverReason] = useState('');

  // Pre-fill expected stock when modal opens
  useEffect(() => {
    if (isOpen) {
      setExpectedInput(
        existingLock ? existingLock.expected_stock.toString() : item.stock.toString()
      );
      setDiscrepancyStep('idle');
      setCarryoverReason('');
    }
  }, [isOpen, item.stock, existingLock]);

  if (!isOpen) return null;

  const expectedStock = parseInt(expectedInput) || 0;
  const lockedStock = item.stock;
  const discrepancy = lockedStock - expectedStock; // positive = surplus, negative = shortage

  const handleLock = async (
    resolution?: { type: 'force_carryover' | 'force_wastage'; reason?: string }
  ) => {
    if (!currentBranch) return;
    setLoading(true);
    const { lock, error } = await lockItem(
      currentBranch.id,
      user?.id ?? null,
      item,
      expectedStock,
      resolution
    );
    setLoading(false);
    if (error) { onError('Failed to lock item. Please try again.'); return; }
    if (lock) onLocked(lock);
  };

  const handleLockAttempt = async () => {
    if (expectedInput === '') { onError('Please enter an expected stock value.'); return; }
    if (discrepancy !== 0) {
      setDiscrepancyStep('resolve');
      return;
    }
    await handleLock();
  };

  const handleUnlock = async () => {
    if (!existingLock || !currentBranch) return;
    setLoading(true);
    const { error } = await unlockItem(currentBranch.id, user?.id ?? null, existingLock);
    setLoading(false);
    if (error) { onError('Failed to unlock item. Please try again.'); return; }
    onUnlocked();
  };

  const discrepancySign = discrepancy > 0 ? '+' : '';
  const discrepancyColor = discrepancy === 0 ? 'text-success' : discrepancy > 0 ? 'text-accent' : 'text-error';

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Processing…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 bg-secondary/10 rounded-xl mx-auto mb-3 flex items-center justify-center">
                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-secondary">{existingLock ? 'Item Locked' : 'Lock Item Stock'}</h3>
              <p className="text-xs text-secondary/60 mt-0.5 truncate px-4">{item.name}</p>
            </div>

            {/* Already-locked view */}
            {existingLock && discrepancyStep === 'idle' ? (
              <>
                <div className="bg-secondary/5 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-secondary/60">Current Stock</span>
                    <span className="font-semibold text-secondary">{existingLock.locked_stock}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-secondary/60">Expected EOD</span>
                    <span className="font-semibold text-secondary">{existingLock.expected_stock}</span>
                  </div>
                  <div className="border-t border-secondary/10 pt-2 flex justify-between text-xs">
                    <span className="text-secondary/60">Discrepancy</span>
                    <span className={`font-bold ${existingLock.discrepancy === 0 ? 'text-success' : existingLock.discrepancy > 0 ? 'text-accent' : 'text-error'}`}>
                      {existingLock.discrepancy > 0 ? '+' : ''}{existingLock.discrepancy}
                    </span>
                  </div>
                  {existingLock.resolution && (
                    <div className="border-t border-secondary/10 pt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        existingLock.resolution === 'force_wastage' ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'
                      }`}>
                        {existingLock.resolution === 'force_wastage' ? 'Sent to Wastage' : 'Force Carry-Over'}
                      </span>
                      {existingLock.resolution_reason && (
                        <p className="text-xs text-secondary/50 mt-1 italic">"{existingLock.resolution_reason}"</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUnlock}
                    className="flex-1 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Unlock
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-secondary rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : discrepancyStep === 'idle' ? (
              /* New lock — set expected stock */
              <>
                <div className="space-y-3 mb-4">
                  {/* Current stock display */}
                  <div className="flex items-center justify-between bg-secondary/5 rounded-lg px-3 py-2">
                    <span className="text-xs text-secondary/60">Actual Stock Now</span>
                    <span className="text-lg font-bold text-secondary">{lockedStock}</span>
                  </div>

                  {/* Expected EOD input */}
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">
                      Expected EOD Stock
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={expectedInput}
                      onChange={(e) => {
                        if (e.target.value === '' || /^[0-9]*$/.test(e.target.value)) {
                          setExpectedInput(e.target.value);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 h-9.5 text-sm border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder="0"
                    />
                  </div>

                  {/* Live discrepancy preview */}
                  {expectedInput !== '' && (
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      discrepancy === 0 ? 'bg-success/10' : 'bg-error/5'
                    }`}>
                      <span className="text-xs text-secondary/60">Discrepancy</span>
                      <span className={`text-sm font-bold ${discrepancyColor}`}>
                        {discrepancySign}{discrepancy} units
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-secondary rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLockAttempt}
                    disabled={expectedInput === ''}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 text-primary rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Lock
                    </span>
                  </button>
                </div>
              </>
            ) : discrepancyStep === 'resolve' ? (
              /* Discrepancy resolution options */
              <>
                <div className="bg-error/5 border border-error/20 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-error">Discrepancy Detected</p>
                      <p className="text-xs text-secondary/70 mt-0.5">
                        Expected <strong>{expectedStock}</strong>, actual <strong>{lockedStock}</strong> ({discrepancySign}{discrepancy} units)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => setDiscrepancyStep('idle')}
                      className="w-full text-left px-3 py-2.5 bg-white border-2 border-secondary/20 hover:border-accent rounded-lg text-xs font-medium text-secondary transition-all"
                    >
                      <span className="font-semibold text-accent">Resolve</span>
                      <span className="text-secondary/60 ml-1">— unlock to fix expected stock</span>
                    </button>
                    <button
                      onClick={() => setDiscrepancyStep('force_carryover_reason')}
                      className="w-full text-left px-3 py-2.5 bg-white border-2 border-secondary/20 hover:border-accent rounded-lg text-xs font-medium text-secondary transition-all"
                    >
                      <span className="font-semibold text-accent">Force Carry-Over</span>
                      <span className="text-secondary/60 ml-1">— requires reason</span>
                    </button>
                    <button
                      onClick={() => handleLock({ type: 'force_wastage' })}
                      className="w-full text-left px-3 py-2.5 bg-white border-2 border-secondary/20 hover:border-error rounded-lg text-xs font-medium text-secondary transition-all"
                    >
                      <span className="font-semibold text-error">Send to Wastage</span>
                      <span className="text-secondary/60 ml-1">— log discrepancy as wastage</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setDiscrepancyStep('idle')}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-secondary rounded-lg text-xs font-semibold transition-all"
                >
                  Back
                </button>
              </>
            ) : (
              /* Force carry-over reason input */
              <>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-xs font-semibold text-secondary">Reason Required</p>
                  </div>
                  <p className="text-xs text-secondary/60 mb-2">
                    Explain why the stock count differs from expected. This will appear in audit records.
                  </p>
                  <textarea
                    value={carryoverReason}
                    onChange={(e) => setCarryoverReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-xs border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                    placeholder="e.g. Items were transferred to another branch, miscounted earlier…"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscrepancyStep('resolve')}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-secondary rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleLock({ type: 'force_carryover', reason: carryoverReason })}
                    disabled={!carryoverReason.trim()}
                    className="flex-1 py-2 bg-accent hover:bg-accent/80 text-primary rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
