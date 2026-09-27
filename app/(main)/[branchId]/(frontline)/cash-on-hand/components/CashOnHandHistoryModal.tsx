'use client';

import { useEffect, useState } from 'react';
import { getCashOnHandEdits } from '@/services/cashOnHandService';
import { formatCurrency } from '@/lib/currency_formatter';
import type { CashOnHandEdit } from '@/types/domain/cashOnHand';
import LoadingSpinner from '@/components/LoadingSpinner';

interface CashOnHandHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashOnHandId: string | null;
  dateLabel: string;
}

function formatEditedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

export default function CashOnHandHistoryModal({
  isOpen,
  onClose,
  cashOnHandId,
  dateLabel,
}: CashOnHandHistoryModalProps) {
  const [edits, setEdits] = useState<CashOnHandEdit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !cashOnHandId) return;
    let cancelled = false;
    setLoading(true);
    getCashOnHandEdits(cashOnHandId).then(({ edits: e }) => {
      if (cancelled) return;
      setEdits(e);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, cashOnHandId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 pb-3 border-b border-secondary/10">
          <h2 className="text-base font-semibold text-secondary">Edit History</h2>
          <p className="text-secondary/60 text-3.5">{dateLabel}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : edits.length === 0 ? (
            <p className="text-secondary/50 text-3.5 py-6 text-center">No history yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {edits.map((edit) => (
                <li key={edit.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-3.5 font-medium text-secondary truncate">
                      {edit.editor_name ?? 'Unknown'}
                    </p>
                    <p className="text-3 text-secondary/50">{formatEditedAt(edit.edited_at)}</p>
                  </div>
                  <p className="text-3.5 text-secondary/80 whitespace-nowrap">
                    {formatCurrency(edit.old_amount)}{' '}
                    <span className="text-secondary/40">→</span>{' '}
                    <span className="font-semibold">{formatCurrency(edit.new_amount)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6 pt-3 border-t border-secondary/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 border border-secondary/30 text-secondary/70 rounded-md hover:bg-secondary/5 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
