'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { lockItem } from '@/services/eodService';
import type { EodItemLock } from '@/types/domain/eod';
import type { InventoryItem } from '@/types/domain/inventory';
import type { Category } from '@/types/domain';

interface ItemAuditState {
  expectedInput: string;
  resolution: 'force_carryover' | 'force_wastage' | null;
  reason: string;
  showReasonInput: boolean;
}

interface BatchAuditModalProps {
  isOpen: boolean;
  branchId: string;
  userId: string | null;
  auditItems: (InventoryItem & { id: string })[];
  auditCategory: Category | null;
  eodLocks: EodItemLock[];
  onClose: () => void;
  onLocked: () => void;
  onError: (msg: string) => void;
}

export default function BatchAuditModal({
  isOpen,
  branchId,
  userId,
  auditItems,
  auditCategory,
  eodLocks,
  onClose,
  onLocked,
  onError,
}: BatchAuditModalProps) {
  const [itemStates, setItemStates] = useState<Record<string, ItemAuditState>>({});
  const [locking, setLocking] = useState(false);

  // Initialize item states when modal opens
  useEffect(() => {
    if (isOpen) {
      const states: Record<string, ItemAuditState> = {};
      for (const item of auditItems) {
        const existingLock = eodLocks.find(l => l.item_id === item.id);
        if (!existingLock) {
          states[item.id] = {
            expectedInput: '',
            resolution: null,
            reason: '',
            showReasonInput: false,
          };
        }
      }
      setItemStates(states);
    }
  }, [isOpen, auditItems, eodLocks]);

  const updateItemState = useCallback((itemId: string, updates: Partial<ItemAuditState>) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...updates },
    }));
  }, []);

  if (!isOpen) return null;

  const lockedItemIds = new Set(eodLocks.map(l => l.item_id).filter(Boolean));
  const unlockedItems = auditItems.filter(item => !lockedItemIds.has(item.id));
  const lockedItems = auditItems.filter(item => lockedItemIds.has(item.id));

  // Check if all unlocked items are ready to lock
  const allReady = unlockedItems.every(item => {
    const state = itemStates[item.id];
    if (!state || state.expectedInput === '') return false;
    const expected = parseInt(state.expectedInput) || 0;
    const discrepancy = item.stock - expected;
    if (discrepancy !== 0 && !state.resolution) return false;
    if (state.resolution === 'force_carryover' && !state.reason.trim()) return false;
    return true;
  });

  const allItemsLocked = unlockedItems.length === 0;

  const handleLockAll = async () => {
    if (!allReady) return;
    setLocking(true);

    for (const item of unlockedItems) {
      const state = itemStates[item.id];
      const expectedStock = parseInt(state.expectedInput) || 0;
      const discrepancy = item.stock - expectedStock;

      const resolution = discrepancy !== 0 && state.resolution
        ? { type: state.resolution as 'force_carryover' | 'force_wastage', reason: state.reason || undefined }
        : undefined;

      const { error } = await lockItem(branchId, userId, item, expectedStock, resolution);
      if (error) {
        setLocking(false);
        onError(`Failed to lock "${item.name}". Please try again.`);
        return;
      }
    }

    setLocking(false);
    onLocked();
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={!locking ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {locking ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Locking items…</p>
            <p className="text-xs text-secondary/50">Auditing {unlockedItems.length} item{unlockedItems.length !== 1 ? 's' : ''}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: auditCategory?.color ? `${auditCategory.color}20` : 'rgb(var(--secondary) / 0.1)' }}
                >
                  <svg className="w-4.5 h-4.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">
                    Audit: {auditCategory?.name ?? 'Unknown'}
                  </h3>
                  <p className="text-xs text-secondary/50">
                    {allItemsLocked
                      ? `All ${auditItems.length} items locked`
                      : `${unlockedItems.length} item${unlockedItems.length !== 1 ? 's' : ''} to audit`
                    }
                    {lockedItems.length > 0 && !allItemsLocked && ` · ${lockedItems.length} already locked`}
                  </p>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0">
              {allItemsLocked ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs font-semibold text-secondary">All items audited</p>
                  <p className="text-xs text-secondary/50">You can now carry over all items.</p>
                </div>
              ) : (
                <>
                  {/* Unlocked items needing audit */}
                  {unlockedItems.map(item => {
                    const state = itemStates[item.id];
                    if (!state) return null;
                    const expectedStock = state.expectedInput !== '' ? (parseInt(state.expectedInput) || 0) : null;
                    const discrepancy = expectedStock !== null ? item.stock - expectedStock : null;
                    const hasDiscrepancy = discrepancy !== null && discrepancy !== 0;

                    return (
                      <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        {/* Item header */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-secondary truncate flex-1">{item.name}</span>
                          <span className="text-xs text-secondary/50 shrink-0 ml-2">stock: {item.stock}</span>
                        </div>

                        {/* Expected input row */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-secondary/60 shrink-0">Expected:</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={state.expectedInput}
                            onChange={(e) => {
                              if (e.target.value === '' || /^[0-9]*$/.test(e.target.value)) {
                                updateItemState(item.id, {
                                  expectedInput: e.target.value,
                                  resolution: null,
                                  reason: '',
                                  showReasonInput: false,
                                });
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="flex-1 px-2 py-1.5 text-xs border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                            placeholder="Count"
                          />
                          {/* Discrepancy indicator */}
                          {discrepancy !== null && (
                            discrepancy === 0 ? (
                              <svg className="w-4 h-4 text-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className={`text-xs font-bold shrink-0 ${discrepancy > 0 ? 'text-accent' : 'text-error'}`}>
                                {discrepancy > 0 ? '+' : ''}{discrepancy}
                              </span>
                            )
                          )}
                        </div>

                        {/* Discrepancy resolution */}
                        {hasDiscrepancy && (
                          <div className="space-y-1.5">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => updateItemState(item.id, {
                                  resolution: 'force_carryover',
                                  showReasonInput: true,
                                })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  state.resolution === 'force_carryover'
                                    ? 'bg-accent text-primary'
                                    : 'bg-accent/10 text-accent hover:bg-accent/20'
                                }`}
                              >
                                Force Carry Over
                              </button>
                              <button
                                onClick={() => updateItemState(item.id, {
                                  resolution: 'force_wastage',
                                  showReasonInput: false,
                                  reason: '',
                                })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  state.resolution === 'force_wastage'
                                    ? 'bg-error text-primary'
                                    : 'bg-error/10 text-error hover:bg-error/20'
                                }`}
                              >
                                Wastage
                              </button>
                            </div>

                            {/* Reason input for force carry over */}
                            {state.showReasonInput && state.resolution === 'force_carryover' && (
                              <input
                                type="text"
                                value={state.reason}
                                onChange={(e) => updateItemState(item.id, { reason: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                                placeholder="Reason for carry-over (required)"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Already locked items */}
                  {lockedItems.length > 0 && (
                    <>
                      <div className="pt-2 pb-1">
                        <p className="text-xs font-semibold text-secondary/40">Already Locked</p>
                      </div>
                      {lockedItems.map(item => {
                        const lock = eodLocks.find(l => l.item_id === item.id);
                        return (
                          <div key={item.id} className="bg-gray-50/50 rounded-xl p-3 opacity-60">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-secondary truncate flex-1">{item.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-secondary/40">exp {lock?.expected_stock}</span>
                                <span className="text-xs font-bold text-secondary">→ {lock?.locked_stock}</span>
                                {lock && lock.discrepancy === 0 ? (
                                  <svg className="w-3 h-3 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="text-xs font-bold text-error">
                                    {lock && lock.discrepancy > 0 ? '+' : ''}{lock?.discrepancy}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                {allItemsLocked ? 'Close' : 'Cancel'}
              </button>
              {!allItemsLocked && (
                <button
                  onClick={handleLockAll}
                  disabled={!allReady}
                  className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Lock All ({unlockedItems.length})
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
