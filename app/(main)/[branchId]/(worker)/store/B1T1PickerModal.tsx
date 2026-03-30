'use client';

import { useState, useMemo } from 'react';
import SafeImage from '@/components/SafeImage';
import LogoIcon from './icons/LogoIcon';
import MinusIcon from './icons/MinusIcon';
import PlusIcon from '@/components/icons/PlusIcon';
import type { InventoryItem } from '@/types/domain';
import { formatCurrency } from '@/lib/currency_formatter';

export interface B1T1PickedItem {
  inventoryItemId: string;
  itemName: string;
  itemImgUrl?: string | null;
  regularPrice: number;
  quantity: number;
  item: InventoryItem;
}

interface B1T1PickerModalProps {
  buyItemName: string;
  maxUnits: number;
  inventory: InventoryItem[];
  onConfirm: (selections: B1T1PickedItem[], b1t1Price: number) => void;
  onClose: () => void;
}

export default function B1T1PickerModal({
  buyItemName,
  maxUnits,
  inventory,
  onConfirm,
  onClose,
}: B1T1PickerModalProps) {
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [priceInput, setPriceInput] = useState('');

  const totalPicked = useMemo(
    () => Object.values(picks).reduce((s, q) => s + q, 0),
    [picks]
  );

  const filteredInventory = useMemo(
    () => inventory.filter(item =>
      (item.stock - (item.uncarried_stock ?? 0)) > 0 &&
      item.name.toLowerCase().includes(search.toLowerCase())
    ),
    [inventory, search]
  );

  const increment = (item: InventoryItem) => {
    if (totalPicked >= maxUnits) return;
    setPicks(prev => ({ ...prev, [item.id!]: (prev[item.id!] ?? 0) + 1 }));
  };

  const decrement = (item: InventoryItem) => {
    const cur = picks[item.id!] ?? 0;
    if (cur <= 0) return;
    setPicks(prev => {
      const next = { ...prev };
      if (next[item.id!] <= 1) delete next[item.id!];
      else next[item.id!]--;
      return next;
    });
  };

  const b1t1Price = parseFloat(priceInput);
  const isPriceValid = priceInput !== '' && !isNaN(b1t1Price) && b1t1Price >= 0;
  const canConfirm = totalPicked > 0 && isPriceValid;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const selections: B1T1PickedItem[] = Object.entries(picks)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = inventory.find(i => i.id === id)!;
        return {
          inventoryItemId: id,
          itemName: item.name,
          itemImgUrl: item.img_url,
          regularPrice: item.price,
          quantity: qty,
          item,
        };
      });
    onConfirm(selections, b1t1Price);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[85dvh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-secondary">Buy 1 Take 1</h2>
            <button
              onClick={onClose}
              className="text-secondary/40 hover:text-secondary transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-secondary/60">
            Customer is buying <span className="font-semibold text-secondary">{buyItemName}</span>.
            Select up to <span className="font-semibold text-secondary">{maxUnits}</span> take-1 item{maxUnits !== 1 ? 's' : ''}.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-medium text-secondary/70">Selected:</span>
            <span className={`text-xs font-bold ${totalPicked >= maxUnits ? 'text-accent' : 'text-secondary'}`}>
              {totalPicked} / {maxUnits}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full px-3 py-2 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {filteredInventory.length === 0 ? (
            <p className="text-center text-xs text-secondary/40 py-6">No items found</p>
          ) : (
            <div className="space-y-1.5">
              {filteredInventory.map(item => {
                const qty = picks[item.id!] ?? 0;
                const canAdd = totalPicked < maxUnits;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <div className="shrink-0 w-10 h-10 bg-gray-200 rounded-md overflow-hidden relative">
                      {item.img_url ? (
                        <SafeImage src={item.img_url} alt={item.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <LogoIcon className="w-6 h-7 opacity-20" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-secondary truncate">{item.name}</p>
                      <p className="text-xs text-secondary/50">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => decrement(item)}
                        disabled={qty === 0}
                        className="flex items-center justify-center w-6 h-6 bg-white border border-secondary/20 rounded-full hover:border-accent hover:bg-accent/10 disabled:opacity-30 transition-all"
                      >
                        <MinusIcon />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-secondary">{qty}</span>
                      <button
                        onClick={() => increment(item)}
                        disabled={!canAdd}
                        className="flex items-center justify-center w-6 h-6 bg-white border border-secondary/20 rounded-full hover:border-accent hover:bg-accent/10 disabled:opacity-30 transition-all"
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* B1T1 Price Input */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <label className="block text-xs font-medium text-secondary/70 mb-1">
            Take-1 Price <span className="text-error">*</span>
            <span className="font-normal text-secondary/50 ml-1">(enter new price for the take-1 items)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-3 text-secondary/50 pointer-events-none">₱</span>
            <input
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={e => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) setPriceInput(v);
              }}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2 text-3 h-9.5 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
          {priceInput !== '' && !isPriceValid && (
            <p className="text-xs text-error mt-1">Enter a valid price (0 or more)</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-black text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${
              canConfirm
                ? 'bg-accent text-primary hover:bg-accent/90 text-shadow-lg'
                : 'bg-gray-200 text-secondary/40 cursor-not-allowed'
            }`}
          >
            ADD TAKE-1 ITEMS
          </button>
        </div>
      </div>
    </div>
  );
}
