'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import SafeImage from '@/components/SafeImage';
import LoadingSpinner from '@/components/LoadingSpinner';
import LogoIcon from './icons/LogoIcon';
import type { InventoryItem } from '@/types/domain';
import { useBranch } from '@/contexts/BranchContext';
import { getFoodHouseConfig } from '@/services/foodHouseService';

export interface FoodHouseResult {
  dish: InventoryItem;
  container: InventoryItem | null; // null = Solo (no container)
  sellingPrice: number;
  grabPrice: number; // per order; falls back to sellingPrice when not set
  quantity: number;
}

interface Props {
  inventory: InventoryItem[];
  onConfirm: (result: FoodHouseResult) => void;
  onClose: () => void;
}

const SOLO = 'SOLO';

// Searchable single-select for the container ("Solo" = no container).
function ContainerSelect({
  containers,
  value,
  onChange,
}: {
  containers: InventoryItem[];
  value: string | null;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = value === SOLO ? null : containers.find(c => c.id === value) ?? null;
  const filtered = useMemo(
    () => containers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [containers, search]
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = value === null ? 'Choose a container…' : value === SOLO ? 'Solo (no container)' : selected?.name ?? 'Choose a container…';
  const showSolo = 'solo'.includes(search.toLowerCase()) || 'solo (no container)'.includes(search.toLowerCase());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
          open ? 'border-bundle ring-2 ring-bundle/30' : 'border-secondary/15 hover:border-secondary/30'
        }`}
      >
        <span className="relative w-8 h-8 rounded-lg bg-secondary/5 overflow-hidden shrink-0 flex items-center justify-center">
          {value === SOLO ? (
            <span className="text-[10px] font-bold text-bundle">SOLO</span>
          ) : selected?.img_url ? (
            <SafeImage src={selected.img_url} alt={selected.name} />
          ) : (
            <LogoIcon className="w-4 h-4 opacity-25" />
          )}
        </span>
        <span className={`flex-1 min-w-0 text-sm font-semibold truncate ${value === null ? 'text-secondary/40' : 'text-secondary'}`}>
          {label}
        </span>
        <svg className={`w-4 h-4 text-secondary/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 bottom-full mb-1.5 w-full rounded-xl border border-secondary/15 bg-white overflow-hidden">
          <div className="p-2 border-b border-secondary/10">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search containers…"
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-secondary/15 focus:outline-none focus:ring-2 focus:ring-bundle/40"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {showSolo && (
              <button
                type="button"
                onClick={() => { onChange(SOLO); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${value === SOLO ? 'bg-bundle/5' : 'hover:bg-secondary/5'}`}
              >
                <span className="w-7 h-7 rounded-lg bg-secondary/5 shrink-0 flex items-center justify-center text-[9px] font-bold text-secondary/50">SOLO</span>
                <span className={`flex-1 text-sm ${value === SOLO ? 'text-bundle font-semibold' : 'text-secondary'}`}>Solo (no container)</span>
                {value === SOLO && <CheckIcon />}
              </button>
            )}
            {filtered.map(c => {
              const active = value === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${active ? 'bg-bundle/5' : 'hover:bg-secondary/5'}`}
                >
                  <span className="relative w-7 h-7 rounded-lg bg-secondary/5 overflow-hidden shrink-0 flex items-center justify-center">
                    {c.img_url ? <SafeImage src={c.img_url} alt={c.name} /> : <LogoIcon className="w-4 h-4 opacity-25" />}
                  </span>
                  <span className={`flex-1 min-w-0 text-sm truncate ${active ? 'text-bundle font-semibold' : 'text-secondary'}`}>{c.name}</span>
                  {active && <CheckIcon />}
                </button>
              );
            })}
            {!showSolo && filtered.length === 0 && (
              <p className="text-xs text-secondary/40 text-center py-6">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-bundle shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function FoodHouseModal({ inventory, onConfirm, onClose }: Props) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [dishIds, setDishIds] = useState<string[]>([]);
  const [containerIds, setContainerIds] = useState<string[]>([]);

  const [dishId, setDishId] = useState<string | null>(null);
  const [sizeKey, setSizeKey] = useState<string | null>(null);
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [grabPriceInput, setGrabPriceInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!currentBranch) return;
    let active = true;
    setLoading(true);
    getFoodHouseConfig(currentBranch.id).then(({ config }) => {
      if (!active) return;
      setDishIds(config.dish_item_ids);
      setContainerIds(config.container_item_ids);
      setLoading(false);
    });
    return () => { active = false; };
  }, [currentBranch]);

  const byId = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    inventory.forEach(i => m.set(i.id, i));
    return m;
  }, [inventory]);

  // Dishes are made-to-order — stock is irrelevant, show all configured dishes.
  const dishes = useMemo(
    () => dishIds.map(id => byId.get(id)).filter((i): i is InventoryItem => !!i),
    [dishIds, byId]
  );
  const containers = useMemo(
    () => containerIds.map(id => byId.get(id)).filter((i): i is InventoryItem => !!i),
    [containerIds, byId]
  );
  const filteredDishes = useMemo(
    () => dishes.filter(d => d.name.toLowerCase().includes(search.toLowerCase())),
    [dishes, search]
  );

  const dish = dishId ? byId.get(dishId) ?? null : null;
  const container = sizeKey && sizeKey !== SOLO ? byId.get(sizeKey) ?? null : null;
  const sellingPrice = parseFloat(sellingPriceInput);
  const sellingPriceValid = !isNaN(sellingPrice) && sellingPrice >= 0;
  const grabParsed = parseFloat(grabPriceInput);
  const grabValid = grabPriceInput.trim() === '' || (!isNaN(grabParsed) && grabParsed >= 0);
  // Grab price defaults to the selling price when the cashier leaves it blank.
  const grabPrice = grabPriceInput.trim() === '' || isNaN(grabParsed) ? sellingPrice : grabParsed;
  const allValid = !!dish && sizeKey !== null && sellingPriceValid && grabValid;

  const handleConfirm = () => {
    if (!allValid || !dish || sizeKey === null) return;
    onConfirm({ dish, container: sizeKey === SOLO ? null : container, sellingPrice, grabPrice, quantity });
  };

  const ctaLabel = !dish
    ? 'Pick a dish'
    : sizeKey === null
    ? 'Pick a container'
    : !sellingPriceValid
    ? 'Set a price'
    : `Add to Order · ₱${(sellingPrice * quantity).toFixed(2)}`;

  const sizeLabel = sizeKey === SOLO ? 'Solo' : container?.name;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-secondary/10">
          <div className="w-10 h-10 rounded-xl bg-bundle/10 shrink-0 flex items-center justify-center text-bundle">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 3v7a3 3 0 003 3v8M7 3v5M10 3v5M17 3c-1.5 1.5-2 4-2 7s.5 4 2 4v7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-secondary leading-tight">Food House</h3>
            <p className="text-xs text-secondary/50">Made to order — pick a dish &amp; size, set the price</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1.5 -mr-1 rounded-lg text-secondary/50 hover:bg-secondary/10 hover:text-secondary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><LoadingSpinner /></div>
        ) : (
          <>
            {/* Step 1: dish + search */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-bundle/15 text-bundle text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Dish</span>
              </div>
              {dishes.length > 4 && (
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search dishes…"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-secondary/15 focus:outline-none focus:ring-2 focus:ring-bundle/40 focus:border-bundle"
                  />
                </div>
              )}
            </div>

            {/* Dish grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-3 pt-1 min-h-0">
              {dishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-secondary/40 gap-2 text-center">
                  <LogoIcon className="w-10 h-10 opacity-15" />
                  <p className="text-xs max-w-[16rem]">No dishes configured. Set them up in Inventory → Bundles → Food House.</p>
                </div>
              ) : filteredDishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-secondary/40">
                  <p className="text-xs">No matches</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredDishes.map(d => {
                    const active = dishId === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDishId(d.id)}
                        className={`rounded-xl border overflow-hidden text-left transition-colors ${
                          active ? 'border-bundle bg-bundle/5 ring-2 ring-bundle/30' : 'border-secondary/12 bg-white hover:border-secondary/30'
                        }`}
                      >
                        <div className="relative w-full h-24 bg-secondary/5 flex items-center justify-center">
                          {d.img_url ? <SafeImage src={d.img_url} alt={d.name} /> : <LogoIcon className="w-9 h-9 opacity-15" />}
                          {active && (
                            <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-bundle text-white flex items-center justify-center">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </span>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold text-secondary truncate">{d.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: container */}
            <div className="px-5 pt-3 pb-3 border-t border-secondary/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-bundle/15 text-bundle text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Container</span>
              </div>
              <ContainerSelect containers={containers} value={sizeKey} onChange={setSizeKey} />
            </div>

            {/* Footer: summary + quantity + price + actions */}
            <div className="border-t border-secondary/10 px-5 py-3.5 space-y-3">
              {dish && sizeKey !== null && (
                <p className="text-xs text-secondary/60 truncate">
                  <span className="font-semibold text-secondary">{dish.name}</span>
                  <span className="text-secondary/40"> · {sizeLabel}</span>
                </p>
              )}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-secondary shrink-0">Quantity</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary/8 text-secondary text-lg font-bold disabled:opacity-30 hover:bg-secondary/15 active:scale-90 transition-all"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={String(quantity)}
                    onChange={e => { if (/^\d*$/.test(e.target.value)) setQuantity(Math.max(1, parseInt(e.target.value || '1', 10))); }}
                    onFocus={e => e.target.select()}
                    aria-label="Quantity"
                    className="w-12 h-9 text-center text-sm font-bold tabular-nums text-secondary border border-secondary/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-bundle"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(q => q + 1)}
                    aria-label="Increase quantity"
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-bundle/15 text-bundle text-lg font-bold hover:bg-bundle/25 active:scale-90 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="foodhouse-price" className="text-sm font-semibold text-secondary shrink-0">Price each</label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/50">₱</span>
                  <input
                    id="foodhouse-price"
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
                <label htmlFor="foodhouse-grab" className="text-sm font-semibold text-secondary shrink-0">
                  Grab each <span className="text-secondary/40 font-normal">(optional)</span>
                </label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/50">₱</span>
                  <input
                    id="foodhouse-grab"
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
                      ? 'bg-accent text-white hover:bg-accent/90 active:scale-[0.98]'
                      : 'bg-secondary/15 text-secondary/40 cursor-not-allowed'
                  }`}
                >
                  {ctaLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
