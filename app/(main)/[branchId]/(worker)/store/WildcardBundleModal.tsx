'use client';

import { useState, useMemo } from 'react';
import SafeImage from '@/components/SafeImage';
import LogoIcon from './icons/LogoIcon';
import type { Category, InventoryItem } from '@/types/domain';

export interface WildcardPickedItem {
  inventoryItemId: string;
  quantity: number;
  itemName: string;
  itemImgUrl?: string | null;
  cost: number;
  item: InventoryItem;
}

export interface WildcardBundleResult {
  maxPieces: number;
  sizeLabel: string;
  sellingPrice: number;
  grabPrice: number;
  selections: WildcardPickedItem[];
}

interface WildcardBundleModalProps {
  inventory: InventoryItem[];
  categories: Category[];
  onConfirm: (result: WildcardBundleResult) => void;
  onClose: () => void;
}

type SizeKey = 'MINI' | 'SMALL' | 'MEDIUM' | 'XL';
const SIZES: { key: SizeKey; pieces: number; w: number; h: number }[] = [
  { key: 'MINI',   pieces: 25,  w: 24, h: 16 },
  { key: 'SMALL',  pieces: 41,  w: 30, h: 19 },
  { key: 'MEDIUM', pieces: 70,  w: 36, h: 25 },
  { key: 'XL',     pieces: 110, w: 42, h: 31 },
];

const KAKANIN_CATEGORY_NAME = 'KAKANIN';

export default function WildcardBundleModal({
  inventory,
  categories,
  onConfirm,
  onClose,
}: WildcardBundleModalProps) {
  const [selectedSize, setSelectedSize] = useState<SizeKey | null>(null);
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [grabPriceInput, setGrabPriceInput] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  const maxPieces = SIZES.find(s => s.key === selectedSize)?.pieces ?? 0;
  const sellingPrice = parseFloat(sellingPriceInput);
  const grabPrice = parseFloat(grabPriceInput);

  const sizeValid = selectedSize !== null;
  const sellingPriceValid = !isNaN(sellingPrice) && sellingPrice >= 0;
  const grabPriceValid = !isNaN(grabPrice) && grabPrice >= 0;

  const totalPicked = useMemo(
    () => Object.values(picks).reduce((s, q) => s + q, 0),
    [picks]
  );

  // Hardcoded KAKANIN category lookup
  const kakaninCategoryIds = useMemo(
    () => categories
      .filter(c => c.name.trim().toUpperCase() === KAKANIN_CATEGORY_NAME)
      .map(c => c.id),
    [categories]
  );

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (item.stock <= 0) return false;
      if (!item.name.toLowerCase().includes(search.toLowerCase())) return false;
      const itemCatIds: string[] = item.category_ids?.length
        ? item.category_ids
        : item.category_id
        ? [item.category_id]
        : [];
      return itemCatIds.some(id => kakaninCategoryIds.includes(id));
    });
  }, [inventory, search, kakaninCategoryIds]);

  const selectSize = (key: SizeKey) => {
    setSelectedSize(key);
    // Trim picks down to new max if smaller
    const newMax = SIZES.find(s => s.key === key)!.pieces;
    setPicks(prev => {
      const total = Object.values(prev).reduce((s, q) => s + q, 0);
      if (total <= newMax) return prev;
      // Drop from end deterministically
      const entries = Object.entries(prev);
      let toRemove = total - newMax;
      const next: Record<string, number> = {};
      for (const [id, qty] of entries) {
        if (toRemove <= 0) { next[id] = qty; continue; }
        if (qty <= toRemove) { toRemove -= qty; continue; }
        next[id] = qty - toRemove;
        toRemove = 0;
      }
      return next;
    });
  };

  const increment = (item: InventoryItem) => {
    if (!sizeValid) return;
    if (totalPicked >= maxPieces) return;
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

  const allValid =
    sizeValid &&
    sellingPriceValid &&
    grabPriceValid &&
    totalPicked === maxPieces;

  const handleConfirm = () => {
    if (!allValid || !selectedSize) return;
    const selections: WildcardPickedItem[] = Object.entries(picks)
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
    onConfirm({
      maxPieces,
      sizeLabel: selectedSize,
      sellingPrice,
      grabPrice,
      selections,
    });
  };

  const progressPercent = sizeValid
    ? Math.min((totalPicked / maxPieces) * 100, 100)
    : 0;

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
            <div className="relative w-12 h-12 bg-bundle/10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
              <svg className="w-7 h-7 text-bundle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="13" rx="9" ry="6" />
                <ellipse cx="12" cy="11.5" rx="9" ry="6" />
                <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="13" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="10.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-secondary truncate">Wildcard Bilao</h3>
              <p className="text-xs text-secondary/50">Pick a size, then fill with kakanin</p>
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

          {/* Size selector */}
          <div className="mb-3">
            <label className="text-3 text-secondary/60 font-medium block mb-1.5">Bilao size</label>
            <div className="flex items-end justify-between gap-2">
              {SIZES.map(s => {
                const selected = selectedSize === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => selectSize(s.key)}
                    className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                      selected
                        ? 'border-bundle bg-bundle/5'
                        : 'border-secondary/15 bg-white hover:border-secondary/30'
                    }`}
                  >
                    <div className="h-12 w-full flex items-end justify-center">
                      <div
                        className={`rounded-full border-2 transition-colors ${
                          selected ? 'border-bundle bg-bundle/20' : 'border-secondary/30 bg-secondary/5'
                        }`}
                        style={{ width: `${s.w}px`, height: `${s.h}px` }}
                      />
                    </div>
                    <span className={`text-3 font-bold ${selected ? 'text-bundle' : 'text-secondary'}`}>{s.key}</span>
                    <span className="text-[10px] text-secondary/50">{s.pieces} pcs</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price inputs */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-3 text-secondary/60 font-medium">Sell price (₱)</label>
              <input
                type="text"
                inputMode="decimal"
                value={sellingPriceInput}
                onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setSellingPriceInput(e.target.value); }}
                onFocus={e => e.target.select()}
                placeholder="0.00"
                className="w-full mt-1 px-2 py-1.5 text-xs border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-bundle/50 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-3 text-secondary/60 font-medium">Grab price (₱)</label>
              <input
                type="text"
                inputMode="decimal"
                value={grabPriceInput}
                onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setGrabPriceInput(e.target.value); }}
                onFocus={e => e.target.select()}
                placeholder="0.00"
                className="w-full mt-1 px-2 py-1.5 text-xs border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-bundle/50 focus:border-transparent"
              />
            </div>
          </div>

          {/* Progress bar */}
          {sizeValid && (
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
          )}
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
              placeholder="Search kakanin..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-bundle/50"
            />
          </div>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {!sizeValid ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary/40">
              <p className="text-xs">Pick a bilao size to begin</p>
            </div>
          ) : kakaninCategoryIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary/40">
              <p className="text-xs">No KAKANIN category found</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary/40">
              <p className="text-xs">No kakanin in stock</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredInventory.map((item) => {
                const qty = picks[item.id!] ?? 0;
                const canAdd = totalPicked < maxPieces;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-2 flex flex-col gap-1.5 transition-colors ${
                      qty > 0 ? 'border-bundle/60 bg-bundle/5' : 'border-secondary/15 bg-white'
                    }`}
                  >
                    <div className="relative w-full h-20 bg-secondary/5 rounded-lg overflow-hidden flex items-center justify-center">
                      {item.img_url
                        ? <SafeImage src={item.img_url} alt={item.name} />
                        : <LogoIcon className="w-8 h-9 opacity-15" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-secondary truncate">{item.name}</p>
                      <p className="text-[10px] text-secondary/50">Stock: {item.stock}</p>
                    </div>
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
        <div className="p-4 border-t border-secondary/10">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allValid}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                allValid
                  ? 'bg-accent hover:bg-accent/90 text-white hover:scale-105 active:scale-95 cursor-pointer'
                  : 'bg-secondary/20 text-secondary/40 cursor-not-allowed'
              }`}
            >
              {!sizeValid
                ? 'Pick a size'
                : !sellingPriceValid || !grabPriceValid
                ? 'Set prices'
                : totalPicked !== maxPieces
                ? `${maxPieces - totalPicked} more needed`
                : 'Add to Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
