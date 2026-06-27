'use client';

import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { branchService, type Branch } from '@/services/branchService';

type ResetMode = 'sales' | 'inventory' | 'everything';

const MODES: { value: ResetMode; label: string; description: string; color: string }[] = [
  {
    value: 'sales',
    label: 'Reset Sales',
    description: 'Clears all orders, shifts, safe drops, write-offs, wastage logs, and end-of-day records. Inventory and categories are kept.',
    color: 'border-amber-400 bg-amber-50',
  },
  {
    value: 'inventory',
    label: 'Reset Inventory',
    description: 'Clears all items, categories, and bundles. Sales history and orders are kept.',
    color: 'border-amber-400 bg-amber-50',
  },
  {
    value: 'everything',
    label: 'Reset Everything',
    description: 'Clears all sales, inventory, discounts, attendance, transfers, and activity logs. Only the branch and its workers remain.',
    color: 'border-error bg-error/5',
  },
];

interface ResetBranchDataModalProps {
  isOpen: boolean;
  branch: Branch;
  onClose: () => void;
  onReset: () => void;
  onError: (message: string) => void;
}

export default function ResetBranchDataModal({ isOpen, branch, onClose, onReset, onError }: ResetBranchDataModalProps) {
  const [mode, setMode] = useState<ResetMode>('sales');
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);

  if (!isOpen) return null;

  const nameMatches = confirmation.trim() === branch.name;

  const handleReset = async () => {
    if (!nameMatches) return;
    setResetting(true);
    const { error } = await branchService.resetBranchData(branch.id, mode);
    setResetting(false);
    if (error) {
      onError(error.message || 'Failed to reset branch data');
      return;
    }
    setConfirmation('');
    setMode('sales');
    onReset();
  };

  const handleClose = () => {
    if (resetting) return;
    setConfirmation('');
    setMode('sales');
    onClose();
  };

  const selectedMode = MODES.find(m => m.value === mode)!;

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {resetting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Resetting branch data...</p>
            <p className="text-xs text-secondary/50">This may take a moment</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-error/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Reset Branch Data</h3>
                  <p className="text-xs text-secondary/50">{branch.name}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Mode Selection */}
              <div className="space-y-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { setMode(m.value); setConfirmation(''); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      mode === m.value
                        ? m.value === 'everything'
                          ? 'border-error bg-error/5'
                          : 'border-accent bg-accent/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        mode === m.value
                          ? m.value === 'everything' ? 'border-error' : 'border-accent'
                          : 'border-gray-300'
                      }`}>
                        {mode === m.value && (
                          <div className={`w-2 h-2 rounded-full ${
                            m.value === 'everything' ? 'bg-error' : 'bg-accent'
                          }`} />
                        )}
                      </div>
                      <span className="text-xs font-bold text-secondary">{m.label}</span>
                    </div>
                    <p className="text-xs text-secondary/50 mt-1 ml-6">{m.description}</p>
                  </button>
                ))}
              </div>

              {/* Warning */}
              <div className={`border rounded-xl p-3 flex items-start gap-2 ${selectedMode.color}`}>
                <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-error">
                  This action <strong>cannot be undone</strong>. All selected data will be permanently deleted.
                </p>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">
                  Type <span className="text-error font-bold">{branch.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={branch.name}
                  className="w-full border border-secondary/20 rounded-xl h-10 px-3 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-error focus:border-transparent"
                />
              </div>
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
                onClick={handleReset}
                disabled={!nameMatches}
                className="flex-1 py-2.5 bg-error hover:bg-error/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Reset {selectedMode.label.replace('Reset ', '')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
