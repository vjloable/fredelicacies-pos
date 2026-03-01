'use client';

import { useState, useMemo } from 'react';
import SafeImage from '@/components/SafeImage';
import LogoIcon from './icons/LogoIcon';
import type { BundleWithComponents, InventoryItem } from '@/types/domain';

export interface PickedItem {
  inventoryItemId: string;
  quantity: number;
  itemName: string;
  itemImgUrl?: string | null;
  cost: number;
  item: InventoryItem;
}

interface CustomBundlePickerModalProps {
  bundle: BundleWithComponents;
  inventory: InventoryItem[];
  onConfirm: (selections: PickedItem[]) => void;
  onClose: () => void;
}

export default function CustomBundlePickerModal({
  bundle,
  inventory,
  onConfirm,
  onClose,
}: CustomBundlePickerModalProps) {
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  const maxPieces = bundle.max_pieces ?? 1;

  const totalPicked = useMemo(
    () => Object.values(picks).reduce((s, q) => s + q, 0),
    [picks]
  );

  const filteredInventory = useMemo(
    () => inventory.filter(item =>
      item.stock > 0 &&
      item.name.toLowerCase().includes(search.toLowerCase())
    ),
    [inventory, search]
  );

  const increment = (item: InventoryItem) => {
    if (totalPicked >= maxPieces) return;
    if ((picks[item.id!] ?? 0) >= item.stock) return;
    setPicks(prev => ({ ...prev, [item.id!]: (prev[item.id!] ?? 0) + 1 }));
  };

  const decrement = (item: InventoryItem) => {
    if ((picks[item.id!] ?? 0) <= 0) return;
    setPicks(prev => {
      const next = { ...prev, [item.id!]: prev[item.id!] - 1 };
      if (next[item.id!] === 0) delete next[item.id!];
      return next;
    });
  };

  const handleConfirm = () => {
    const selections: PickedItem[] = Object.entries(picks)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = inventory.find(i => i.id === itemId)!;
        return {
          inventoryItemId: itemId,
          quantity: qty,
          itemName: item.name,
          itemImgUrl: item.img_url,
          cost: (item.cost ?? 0) * qty,
          item,
        };
      });
    onConfirm(selections);
  };

  // Progress bar fill percentage
  const progressPercent = Math.min((totalPicked / maxPieces) * 100, 100);

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-secondary/10">
          <div className="flex items-center gap-3 mb-3">
            {/* Bundle image / logo */}
            <div className="relative w-12 h-12 bg-bundle/10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
              {bundle.img_url
                ? <SafeImage src={bundle.img_url} alt={bundle.name} />
                : <LogoIcon className="w-6 h-7 opacity-20" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-secondary truncate">{bundle.name}</h3>
              <p className="text-xs text-secondary/50">Choose exactly {maxPieces} {maxPieces === 1 ? 'piece' : 'pieces'}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle"
            >
              <svg className="w-4 h-4 text-secondary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-secondary/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-bundle rounded-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums ${totalPicked === maxPieces ? 'text-bundle' : 'text-secondary/50'}`}>
              {totalPicked}/{maxPieces}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-secondary/10">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-bundle/50"
            />
          </div>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary/40">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs">No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredInventory.map((item) => {
                const qty = picks[item.id!] ?? 0;
                const atStockLimit = qty >= item.stock;
                const atPickLimit = totalPicked >= maxPieces;
                const canAdd = !atStockLimit && !atPickLimit;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-2 flex flex-col gap-1.5 transition-colors ${
                      qty > 0
                        ? 'border-bundle/60 bg-bundle/5'
                        : 'border-secondary/15 bg-white'
                    }`}
                  >
                    {/* Item image */}
                    <div className="relative w-full h-20 bg-secondary/5 rounded-lg overflow-hidden flex items-center justify-center">
                      {item.img_url
                        ? <SafeImage src={item.img_url} alt={item.name} />
                        : <LogoIcon className="w-8 h-9 opacity-15" />
                      }
                    </div>

                    {/* Item info */}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-secondary truncate">{item.name}</p>
                      <p className="text-[10px] text-secondary/50">Stock: {item.stock}</p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-auto">
                      <button
                        onClick={() => decrement(item)}
                        disabled={qty <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary/10 text-secondary font-bold disabled:opacity-30 hover:bg-secondary/20 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle"
                      >
                        −
                      </button>
                      <span className={`text-sm font-bold tabular-nums ${qty > 0 ? 'text-bundle' : 'text-secondary/30'}`}>
                        {qty}
                      </span>
                      <button
                        onClick={() => increment(item)}
                        disabled={!canAdd}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-bundle/20 text-bundle font-bold disabled:opacity-30 hover:bg-bundle/30 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-secondary/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={totalPicked !== maxPieces}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              totalPicked === maxPieces
                ? 'bg-accent hover:bg-accent/90 text-white hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-secondary/20 text-secondary/40 cursor-not-allowed'
            }`}
          >
            {totalPicked === maxPieces
              ? 'Confirm Selection'
              : `${maxPieces - totalPicked} more needed`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
