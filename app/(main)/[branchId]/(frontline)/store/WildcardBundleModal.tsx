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
  grabPrice: number; // falls back to sellingPrice when not set
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
  { key: 'MINI',   pieces: 25,  w: 22, h: 15 },
  { key: 'SMALL',  pieces: 41,  w: 28, h: 18 },
  { key: 'MEDIUM', pieces: 70,  w: 34, h: 22 },
  { key: 'XL',     pieces: 110, w: 40, h: 26 },
];

const ALLOWED_CATEGORY_NAMES = ['KAKANIN', 'TUBS'];

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

  const sizeValid = selectedSize !== null;
  const sellingPriceValid = !isNaN(sellingPrice) && sellingPrice >= 0;
  const grabParsed = parseFloat(grabPriceInput);
  const grabValid = grabPriceInput.trim() === '' || (!isNaN(grabParsed) && grabParsed >= 0);
  const grabPrice = grabPriceInput.trim() === '' || isNaN(grabParsed) ? sellingPrice : grabParsed;

  const totalPicked = useMemo(
    () => Object.values(picks).reduce((s, q) => s + q, 0),
    [picks]
  );

  // Hardcoded allow-list category lookup (KAKANIN + TUBS)
  const allowedCategoryIds = useMemo(
    () => categories
      .filter(c => ALLOWED_CATEGORY_NAMES.includes(c.name.trim().toUpperCase()))
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
      return itemCatIds.some(id => allowedCategoryIds.includes(id));
    });
  }, [inventory, search, allowedCategoryIds]);

  const selectSize = (key: SizeKey) => {
    setSelectedSize(key);
    // Trim picks down to new max if smaller
    const newMax = SIZES.find(s => s.key === key)!.pieces;
    setPicks(prev => {
      const total = Object.values(prev).reduce((s, q) => s + q, 0);
      if (total <= newMax) return prev;
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

  // Directly set a typed quantity, clamped to the remaining bilao capacity.
  const setQty = (item: InventoryItem, value: number) => {
    if (!sizeValid) return;
    const id = item.id!;
    const others = totalPicked - (picks[id] ?? 0);
    const roomLeft = Math.max(0, maxPieces - others);
    const capped = Math.min(Math.max(0, Math.floor(value || 0)), roomLeft);
    setPicks(prev => {
      const next = { ...prev };
      if (capped <= 0) delete next[id];
      else next[id] = capped;
      return next;
    });
  };

  const allValid = sizeValid && sellingPriceValid && grabValid && totalPicked === maxPieces;

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
    onConfirm({ maxPieces, sizeLabel: selectedSize, sellingPrice, grabPrice, selections });
  };

  const progressPercent = sizeValid ? Math.min((totalPicked / maxPieces) * 100, 100) : 0;
  const full = sizeValid && totalPicked === maxPieces;

  const ctaLabel = !sizeValid
    ? 'Pick a size'
    : totalPicked !== maxPieces
    ? `${maxPieces - totalPicked} more needed`
    : !sellingPriceValid
    ? 'Set a price'
    : 'Add to Order';

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-secondary/10">
          <div className="w-10 h-10 rounded-xl bg-bundle/10 shrink-0 flex items-center justify-center text-bundle">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="13" rx="9" ry="6" />
              <ellipse cx="12" cy="11.5" rx="9" ry="6" />
              <circle cx="9" cy="11" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="13" cy="10" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-secondary leading-tight">Wildcard Bilao</h3>
            <p className="text-xs text-secondary/50">Pick a size, fill it with kakanin, set one price</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1.5 -mr-1 rounded-lg text-secondary/50 hover:bg-secondary/10 hover:text-secondary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: bilao size */}
        <div className="px-5 pt-4 pb-3 border-b border-secondary/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-bundle/15 text-bundle text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
            <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Bilao size</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map(s => {
              const selected = selectedSize === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => selectSize(s.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                    selected ? 'border-bundle bg-bundle/5 ring-2 ring-bundle/30' : 'border-secondary/15 hover:border-secondary/30'
                  }`}
                >
                  <div className="h-8 flex items-end justify-center">
                    <div
                      className={`rounded-full border transition-colors ${selected ? 'border-bundle bg-bundle/20' : 'border-secondary/30 bg-secondary/5'}`}
                      style={{ width: `${s.w}px`, height: `${s.h}px` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${selected ? 'text-bundle' : 'text-secondary'}`}>{s.key}</span>
                  <span className="text-[10px] text-secondary/50">{s.pieces} pcs</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: kakanin */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-bundle/15 text-bundle text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Fill the bilao</span>
            </div>
            {sizeValid && (
              <span className={`text-xs font-bold tabular-nums ${full ? 'text-bundle' : 'text-secondary/50'}`}>
                {totalPicked}/{maxPieces} pcs
              </span>
            )}
          </div>

          {/* Capacity progress */}
          {sizeValid && (
            <div className="h-1.5 bg-secondary/10 rounded-full overflow-hidden mb-2.5">
              <div className="h-full bg-bundle rounded-full transition-all duration-200" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search kakanin…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-secondary/15 focus:outline-none focus:ring-2 focus:ring-bundle/40 focus:border-bundle"
            />
          </div>
        </div>

        {/* Kakanin grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2 min-h-0">
          {!sizeValid ? (
            <div className="flex flex-col items-center justify-center py-12 text-secondary/40 gap-2">
              <LogoIcon className="w-10 h-10 opacity-15" />
              <p className="text-xs">Pick a bilao size to begin</p>
            </div>
          ) : allowedCategoryIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-secondary/40">
              <p className="text-xs">No KAKANIN or TUBS category found</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-secondary/40 gap-2">
              <LogoIcon className="w-10 h-10 opacity-15" />
              <p className="text-xs">No kakanin in stock</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredInventory.map((item) => {
                const qty = picks[item.id!] ?? 0;
                const active = qty > 0;
                const canAdd = totalPicked < maxPieces;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border overflow-hidden transition-colors ${
                      active ? 'border-bundle bg-bundle/5' : 'border-secondary/12 bg-white'
                    }`}
                  >
                    <div className="relative w-full h-24 bg-secondary/5 flex items-center justify-center">
                      {item.img_url ? <SafeImage src={item.img_url} alt={item.name} /> : <LogoIcon className="w-9 h-9 opacity-15" />}
                      {active && (
                        <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-bundle text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                          {qty}
                        </span>
                      )}
                    </div>
                    <div className="px-2 pt-1.5">
                      <p className="text-xs font-semibold text-secondary truncate">{item.name}</p>
                      <p className="text-[10px] text-secondary/50">Stock: {item.stock}</p>
                    </div>
                    <div className="flex items-center gap-1.5 p-2">
                      <button
                        onClick={() => decrement(item)}
                        disabled={qty <= 0}
                        aria-label={`Remove one ${item.name}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/8 text-secondary text-lg font-bold disabled:opacity-30 hover:bg-secondary/15 active:bg-secondary/25 transition-all"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={qty === 0 ? '' : String(qty)}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setQty(item, parseInt(e.target.value || '0', 10)); }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        aria-label={`${item.name} quantity`}
                        className={`flex-1 min-w-0 h-8 text-center text-sm font-bold tabular-nums bg-transparent border border-secondary/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-bundle ${active ? 'text-bundle' : 'text-secondary/40'}`}
                      />
                      <button
                        onClick={() => increment(item)}
                        disabled={!canAdd}
                        aria-label={`Add one ${item.name}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-bundle/15 text-bundle text-lg font-bold disabled:opacity-30 hover:bg-bundle/25 active:bg-bundle/35 transition-all"
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

        {/* Footer: price + actions */}
        <div className="border-t border-secondary/10 px-5 py-3.5 space-y-3">
          <div className="flex items-center gap-3">
            <label htmlFor="wildcard-price" className="text-sm font-semibold text-secondary shrink-0">Selling price</label>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/50">₱</span>
              <input
                id="wildcard-price"
                type="text"
                inputMode="decimal"
                value={sellingPriceInput}
                onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setSellingPriceInput(e.target.value); }}
                onFocus={e => e.target.select()}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 text-right text-base font-bold tabular-nums text-secondary border border-secondary/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-bundle/40 focus:border-bundle"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="wildcard-grab" className="text-sm font-semibold text-secondary shrink-0">
              Grab price <span className="text-secondary/40 font-normal">(optional)</span>
            </label>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/50">₱</span>
              <input
                id="wildcard-grab"
                type="text"
                inputMode="decimal"
                value={grabPriceInput}
                onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setGrabPriceInput(e.target.value); }}
                onFocus={e => e.target.select()}
                placeholder={sellingPriceValid ? sellingPrice.toFixed(2) : '0.00'}
                className="w-full pl-7 pr-3 py-2 text-right text-base font-bold tabular-nums text-secondary border border-secondary/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-bundle/40 focus:border-bundle"
              />
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-secondary/8 text-secondary text-sm font-semibold hover:bg-secondary/15 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allValid}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                allValid
                  ? 'bg-accent text-white hover:bg-accent/90 active:bg-light-accent active:text-accent'
                  : 'bg-secondary/15 text-secondary/40 cursor-not-allowed'
              }`}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
