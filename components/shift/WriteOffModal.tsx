'use client';

import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useShift } from '@/contexts/ShiftContext';
import { formatCurrency } from '@/lib/currency_formatter';
import type { InventoryItem } from '@/types/domain';
import type { WriteOffType } from '@/types/domain/writeOff';

interface WriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
}

export default function WriteOffModal({ isOpen, onClose, inventoryItems }: WriteOffModalProps) {
  const shift = useShift();
  const [type, setType] = useState<WriteOffType>('free');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const parsedQty = parseInt(quantity) || 0;
  const calculatedAmount = selectedItem ? parsedQty * selectedItem.price : 0;
  const parsedAmount = amount !== '' ? parseFloat(amount) || 0 : calculatedAmount;
  const maxStock = selectedItem ? (selectedItem.stock ?? 0) : 0;
  const canSubmit = selectedItem && parsedQty > 0 && parsedQty <= maxStock && parsedAmount >= 0;

  const filtered = search.trim()
    ? inventoryItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : inventoryItems;

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setQuantity('1');
    setAmount('');
    setSearch('');
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedItem) return;
    setSubmitting(true);
    setError('');
    await shift.addWriteOff({
      type,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity: parsedQty,
      amount: parsedAmount,
      reason: reason.trim() || undefined,
    });
    if (shift.error) {
      setError(shift.error);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    resetAndClose();
  };

  const resetAndClose = () => {
    setType('free');
    setSelectedItem(null);
    setQuantity('1');
    setAmount('');
    setReason('');
    setSearch('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={!submitting ? resetAndClose : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {submitting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-semibold text-secondary">Recording write-off…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-error/10 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary">Write Off</h3>
                  <p className="text-xs text-secondary/50">Record free or near-expiry items</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Type Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setType('free')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    type === 'free'
                      ? 'bg-accent text-primary'
                      : 'bg-gray-100 text-secondary hover:bg-gray-200'
                  }`}
                >
                  Free Item
                </button>
                <button
                  onClick={() => setType('near_expiry')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    type === 'near_expiry'
                      ? 'bg-accent text-primary'
                      : 'bg-gray-100 text-secondary hover:bg-gray-200'
                  }`}
                >
                  Near Expiry
                </button>
              </div>

              {/* Item Selection */}
              {!selectedItem ? (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">Select Item</label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items..."
                    autoFocus
                    className="w-full border border-secondary/20 rounded-xl h-10 px-3 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent mb-2"
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filtered.slice(0, 20).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        disabled={(item.stock ?? 0) <= 0}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all text-left disabled:opacity-40"
                      >
                        <span className="text-xs text-secondary font-medium truncate">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-secondary/50">{item.stock ?? 0} left</span>
                          <span className="text-xs font-bold text-accent">{formatCurrency(item.price)}</span>
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-xs text-secondary/40 py-3 text-center">No items found</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected Item Display */}
                  <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-xl p-3">
                    <div>
                      <p className="text-xs font-bold text-secondary">{selectedItem.name}</p>
                      <p className="text-xs text-secondary/50">{formatCurrency(selectedItem.price)} × unit · {maxStock} in stock</p>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-xs text-accent font-semibold hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">Quantity</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity(String(Math.max(1, parsedQty - 1)))}
                        className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-secondary font-bold hover:bg-gray-200 transition-all"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quantity}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '');
                          setQuantity(v);
                          setAmount('');
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-20 border border-secondary/20 rounded-xl h-10 text-center text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                      <button
                        onClick={() => setQuantity(String(Math.min(maxStock, parsedQty + 1)))}
                        disabled={parsedQty >= maxStock}
                        className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-secondary font-bold hover:bg-gray-200 transition-all disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    {parsedQty > maxStock && (
                      <p className="text-xs text-error mt-1">Cannot exceed {maxStock} in stock</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      Amount <span className="text-secondary/40 font-normal">(auto: {formatCurrency(calculatedAmount)})</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50 font-semibold text-sm">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*\.?\d{0,2}$/.test(v) || v === '') setAmount(v);
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder={calculatedAmount.toFixed(2)}
                        className="w-full border border-secondary/20 rounded-xl h-10 pl-7 pr-3 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">Reason (optional)</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={type === 'free' ? 'e.g. Given to customer' : 'e.g. Expiring tomorrow'}
                      rows={2}
                      className="w-full border border-secondary/20 rounded-xl px-3 py-2 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                    />
                  </div>
                </>
              )}

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
                onClick={resetAndClose}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 bg-error hover:bg-error/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Write Off
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
