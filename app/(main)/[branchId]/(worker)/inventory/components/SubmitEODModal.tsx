'use client';

import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { submitEOD, flagUncarriedItems } from '@/services/eodService';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import type { EodItemLock, EodSession } from '@/types/domain/eod';
import type { InventoryItem } from '@/types/domain/inventory';

interface SubmitEODModalProps {
  isOpen: boolean;
  session: EodSession;
  locks: EodItemLock[];
  allItems: InventoryItem[];
  onClose: () => void;
  onSubmitted: () => void;
  onError: (msg: string) => void;
}

export default function SubmitEODModal({
  isOpen,
  session,
  locks,
  allItems,
  onClose,
  onSubmitted,
  onError,
}: SubmitEODModalProps) {
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const unresolvedDiscrepancies = locks.filter(
    (l) => l.discrepancy !== 0 && !l.resolution
  );
  const withDiscrepancy = locks.filter((l) => l.discrepancy !== 0);
  const clean = locks.filter((l) => l.discrepancy === 0);

  const handleSubmit = async () => {
    if (!currentBranch) return;
    setSubmitting(true);
    const { error } = await submitEOD(
      currentBranch.id,
      user?.id ?? null,
      session.id,
      locks
    );
    if (error) { setSubmitting(false); onError('Failed to submit End-of-Day audit. Please try again.'); return; }

    // Flag items in carryover categories that were NOT locked
    const lockedItemIds = new Set(locks.map(l => l.item_id).filter(Boolean) as string[]);
    await flagUncarriedItems(currentBranch.id, user?.id ?? null, lockedItemIds, allItems);

    setSubmitting(false);
    onSubmitted();
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={!submitting ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {submitting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Submitting End-of-Day Audit…</p>
            <p className="text-xs text-secondary/50">Updating carry-over stock</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Submit End-of-Day Audit</h3>
                  <p className="text-xs text-secondary/50">Locked counts become tomorrow's opening stock</p>
                </div>
              </div>
            </div>

            {/* Summary pills */}
            <div className="px-5 py-3 flex gap-2 flex-wrap border-b border-gray-100">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/10 rounded-full text-xs font-semibold text-secondary">
                {locks.length} item{locks.length !== 1 ? 's' : ''} locked
              </span>
              {clean.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success/10 rounded-full text-xs font-semibold text-success">
                  {clean.length} match
                </span>
              )}
              {withDiscrepancy.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-error/10 rounded-full text-xs font-semibold text-error">
                  {withDiscrepancy.length} discrepanc{withDiscrepancy.length !== 1 ? 'ies' : 'y'}
                </span>
              )}
            </div>

            {/* Unresolved warning */}
            {unresolvedDiscrepancies.length > 0 && (
              <div className="mx-5 mt-3 bg-error/5 border border-error/20 rounded-xl p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-error">
                  <strong>{unresolvedDiscrepancies.length} item{unresolvedDiscrepancies.length !== 1 ? 's have' : ' has'} unresolved discrepancies.</strong>
                  {' '}They will be submitted as-is. Consider locking them again to set a resolution.
                </p>
              </div>
            )}

            {/* Items list */}
            <div className="px-5 py-3 max-h-56 overflow-y-auto space-y-1">
              {locks.map((lock) => (
                <div key={lock.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-xs text-secondary font-medium truncate flex-1">{lock.item_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-secondary/50">exp {lock.expected_stock}</span>
                    <span className="text-xs font-bold text-secondary">→ {lock.locked_stock}</span>
                    {lock.discrepancy !== 0 ? (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        lock.resolution
                          ? 'bg-secondary/10 text-secondary/60'
                          : 'bg-error/10 text-error'
                      }`}>
                        {lock.discrepancy > 0 ? '+' : ''}{lock.discrepancy}
                      </span>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {lock.resolution && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        lock.resolution === 'force_wastage'
                          ? 'bg-error/10 text-error'
                          : 'bg-accent/10 text-accent'
                      }`}>
                        {lock.resolution === 'force_wastage' ? 'wastage' : 'carry'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Submit & Carry Over
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
