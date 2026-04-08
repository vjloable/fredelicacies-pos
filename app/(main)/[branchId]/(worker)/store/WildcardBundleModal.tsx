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
  sellingPrice: number;
  grabPrice: number;
  selections: WildcardPickedItem[];
  selectedCategoryIds: string[];
}

interface WildcardBundleModalProps {
  inventory: InventoryItem[];
  categories: Category[];
  onConfirm: (result: WildcardBundleResult) => void;
  onClose: () => void;
}

export default function WildcardBundleModal({
  inventory,
  categories,
  onConfirm,
  onClose,
}: WildcardBundleModalProps) {
  const [maxPiecesInput, setMaxPiecesInput] = useState('');
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [grabPriceInput, setGrabPriceInput] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  const maxPieces = parseInt(maxPiecesInput, 10);
  const sellingPrice = parseFloat(sellingPriceInput);
  const grabPrice = parseFloat(grabPriceInput);

  const maxPiecesValid = !isNaN(maxPieces) && maxPieces > 0;
  const sellingPriceValid = !isNaN(sellingPrice) && sellingPrice >= 0;
  const grabPriceValid = !isNaN(grabPrice) && grabPrice >= 0;

  const totalPicked = useMemo(
    () => Object.values(picks).reduce((s, q) => s + q, 0),
    [picks]
  );

  const visibleCategories = useMemo(
    () => categories.filter(c => !c.is_hidden),
    [categories]
  );

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (item.stock <= 0) return false;
      if (!item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategoryIds.length === 0) return true;
      const itemCatIds: string[] = item.category_ids?.length
        ? item.category_ids
        : item.category_id
        ? [item.category_id]
        : [];
      return itemCatIds.some(id => selectedCategoryIds.includes(id));
    });
  }, [inventory, search, selectedCategoryIds]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    // Drop picks that no longer match the new filter
    setPicks(prev => {
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([itemId, qty]) => {
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;
        const itemCatIds: string[] = item.category_ids?.length
          ? item.category_ids
          : item.category_id
          ? [item.category_id]
          : [];
        const newSel = prev[id] !== undefined ? selectedCategoryIds.filter(c => c !== id) : [...selectedCategoryIds, id];
        if (newSel.length === 0 || itemCatIds.some(c => newSel.includes(c))) {
          next[itemId] = qty;
        }
      });
      return next;
    });
  };

  const increment = (item: InventoryItem) => {
    if (!maxPiecesValid) return;
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
    maxPiecesValid &&
    sellingPriceValid &&
    grabPriceValid &&
    totalPicked === maxPieces;

  const handleConfirm = () => {
    if (!allValid) return;
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
      sellingPrice,
      grabPrice,
      selections,
      selectedCategoryIds,
    });
  };

  const progressPercent = maxPiecesValid
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
              <svg className="w-6 h-6 text-bundle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-secondary truncate">Wildcard Bundle</h3>
              <p className="text-xs text-secondary/50">Build a custom bundle on the fly</p>
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

          {/* Inputs */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-3 text-secondary/60 font-medium">Max items</label>
              <input
                type="text"
                inputMode="numeric"
                value={maxPiecesInput}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setMaxPiecesInput(e.target.value); }}
                onFocus={e => e.target.select()}
                placeholder="0"
                className="w-full mt-1 px-2 py-1.5 text-xs border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-bundle/50 focus:border-transparent"
              />
            </div>
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

          {/* Category chip dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs border-2 border-secondary/20 rounded-lg bg-white hover:bg-secondary/5 transition-colors"
            >
              <span className="text-secondary/60">
                {selectedCategoryIds.length === 0
                  ? 'Filter by category (all)'
                  : `${selectedCategoryIds.length} category${selectedCategoryIds.length === 1 ? '' : 's'} selected`}
              </span>
              <svg className={`w-3.5 h-3.5 text-secondary/40 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {categoryDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-secondary/20 rounded-lg shadow-lg p-2 max-h-40 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {visibleCategories.length === 0 ? (
                    <span className="text-xs text-secondary/40 px-1">No categories</span>
                  ) : (
                    visibleCategories.map(cat => {
                      const selected = selectedCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`px-2 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                            selected
                              ? 'bg-bundle text-white'
                              : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color?.trim() || '#9CA3AF' }}
                          />
                          {cat.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {maxPiecesValid && (
            <div className="flex items-center gap-2 mt-3">
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
              placeholder="Search items..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-bundle/50"
            />
          </div>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {!maxPiecesValid ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary/40">
              <p className="text-xs">Set a maximum number of items to begin picking</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary/40">
              <p className="text-xs">No items found</p>
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
              {!maxPiecesValid
                ? 'Set max items'
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
