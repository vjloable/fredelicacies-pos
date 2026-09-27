'use client';

import { useEffect, useState } from 'react';
import { setCashOnHand } from '@/services/cashOnHandService';

interface SetCashOnHandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  branchId: string;
  businessDate: string; // 'YYYY-MM-DD'
  dateLabel: string; // human-friendly label for the day being edited
  currentAmount: number | null; // existing amount, or null if no row yet
  userId: string | null;
  onViewHistory?: () => void; // shown only when the day already has records
}

export default function SetCashOnHandModal({
  isOpen,
  onClose,
  onSaved,
  branchId,
  businessDate,
  dateLabel,
  currentAmount,
  userId,
  onViewHistory,
}: SetCashOnHandModalProps) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentAmount != null ? String(currentAmount) : '');
      setError(null);
    }
  }, [isOpen, currentAmount]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const parsed = Number(amount);
    if (amount.trim() === '' || isNaN(parsed) || parsed < 0) {
      setError('Enter a valid amount (0 or more).');
      return;
    }

    setSaving(true);
    setError(null);
    const { error: saveError } = await setCashOnHand(branchId, businessDate, parsed, userId);
    setSaving(false);

    if (saveError) {
      setError('Failed to save. Please try again.');
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-secondary mb-1">
          {currentAmount != null ? 'Update Cash on Hand' : 'Set Cash on Hand'}
        </h2>
        <p className="text-secondary/60 mb-4 text-3.5">{dateLabel}</p>

        <label className="block text-3.5 font-medium text-secondary/70 mb-1.5">
          Amount
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50">₱</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="w-full pl-8 pr-3 py-2 border border-secondary/30 rounded-md text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="0.00"
          />
        </div>

        {error && <p className="text-(--error) text-3.5 mb-4">{error}</p>}

        {currentAmount != null && onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="text-3.5 text-accent hover:underline mb-4"
          >
            View edit history
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-secondary/30 text-secondary/70 rounded-md hover:bg-secondary/5 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/80 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
