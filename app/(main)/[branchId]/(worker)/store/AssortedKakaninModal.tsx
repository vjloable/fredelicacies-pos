'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import SafeImage from '@/components/SafeImage';
import LoadingSpinner from '@/components/LoadingSpinner';
import LogoIcon from './icons/LogoIcon';
import type { InventoryItem } from '@/types/domain';
import { useBranch } from '@/contexts/BranchContext';
import { getAssortedKakaninConfig } from '@/services/assortedKakaninService';

export interface AssortedPickedItem {
  inventoryItemId: string;
  quantity: number;
  itemName: string;
  itemImgUrl?: string | null;
  cost: number;
  item: InventoryItem;
}

export interface AssortedKakaninResult {
  container: InventoryItem;
  sellingPrice: number;
  grabPrice: number; // falls back to sellingPrice when not set
  selections: AssortedPickedItem[];
}

interface Props {
  inventory: InventoryItem[];
  onConfirm: (result: AssortedKakaninResult) => void;
  onClose: () => void;
}

// Single-select dropdown for the container. Collapses a long list into one control.
function ContainerSelect({
  containers,
  value,
  onChange,
}: {
  containers: InventoryItem[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = containers.find(c => c.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

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
          {selected?.img_url ? <SafeImage src={selected.img_url} alt={selected.name} /> : <LogoIcon className="w-4 h-4 opacity-25" />}
        </span>
        <span className={`flex-1 min-w-0 text-sm font-semibold truncate ${selected ? 'text-secondary' : 'text-secondary/40'}`}>
          {selected ? selected.name : 'Choose a container…'}
        </span>
        <svg className={`w-4 h-4 text-secondary/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border border-secondary/15 bg-white shadow-lg">
          {containers.map(c => {
            const active = c.id === value;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  active ? 'bg-bundle/5' : 'hover:bg-secondary/5'
                }`}
              >
                <span className="relative w-7 h-7 rounded-lg bg-secondary/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {c.img_url ? <SafeImage src={c.img_url} alt={c.name} /> : <LogoIcon className="w-4 h-4 opacity-25" />}
                </span>
                <span className={`flex-1 min-w-0 text-sm truncate ${active ? 'text-bundle font-semibold' : 'text-secondary'}`}>{c.name}</span>
                {active && (
                  <svg className="w-4 h-4 text-bundle shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AssortedKakaninModal({ inventory, onConfirm, onClose }: Props) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [containerIds, setContainerIds] = useState<string[]>([]);
  const [kakaninIds, setKakaninIds] = useState<string[]>([]);

  const [containerId, setContainerId] = useState<string | null>(null);
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [grabPriceInput, setGrabPriceInput] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!currentBranch) return;
    let active = true;
    setLoading(true);
    getAssortedKakaninConfig(currentBranch.id).then(({ config }) => {
      if (!active) return;
      setContainerIds(config.container_item_ids);
      setKakaninIds(config.kakanin_item_ids);
      setLoading(false);
    });
    return () => { active = false; };
  }, [currentBranch]);

  const byId = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    inventory.forEach(i => m.set(i.id, i));
    return m;
  }, [inventory]);

  const containers = useMemo(
    () => containerIds.map(id => byId.get(id)).filter((i): i is InventoryItem => !!i),
    [containerIds, byId]
  );

  const allKakanin = useMemo(
    () => kakaninIds.map(id => byId.get(id)).filter((i): i is InventoryItem => !!i).filter(i => i.stock > 0),
    [kakaninIds, byId]
  );
  const kakaninItems = useMemo(
    () => allKakanin.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
    [allKakanin, search]
  );

  const sellingPrice = parseFloat(sellingPriceInput);
  const sellingPriceValid = !isNaN(sellingPrice) && sellingPrice >= 0;
  const grabParsed = parseFloat(grabPriceInput);
  const grabValid = grabPriceInput.trim() === '' || (!isNaN(grabParsed) && grabParsed >= 0);
  const grabPrice = grabPriceInput.trim() === '' || isNaN(grabParsed) ? sellingPrice : grabParsed;
  const totalPicked = useMemo(() => Object.values(picks).reduce((s, q) => s + q, 0), [picks]);
  const distinctPicked = useMemo(() => Object.values(picks).filter(q => q > 0).length, [picks]);

  const increment = (item: InventoryItem) =>
    setPicks(prev => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
  const decrement = (item: InventoryItem) => {
    if ((picks[item.id] ?? 0) <= 0) return;
    setPicks(prev => {
      const next = { ...prev, [item.id]: prev[item.id] - 1 };
      if (next[item.id] === 0) delete next[item.id];
      return next;
    });
  };
  const setQty = (item: InventoryItem, value: number) => {
    const capped = Math.max(0, Math.floor(value || 0));
    setPicks(prev => {
      const next = { ...prev };
      if (capped <= 0) delete next[item.id];
      else next[item.id] = capped;
      return next;
    });
  };

  const container = containerId ? byId.get(containerId) ?? null : null;
  const allValid = !!container && sellingPriceValid && grabValid && totalPicked >= 1;

  const handleConfirm = () => {
    if (!allValid || !container) return;
    const selections: AssortedPickedItem[] = Object.entries(picks)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = byId.get(itemId)!;
        return {
          inventoryItemId: itemId,
          quantity: qty,
          itemName: item.name,
          itemImgUrl: item.img_url,
          cost: (item.cost ?? 0) * qty,
          item,
        };
      });
    onConfirm({ container, sellingPrice, grabPrice, selections });
  };

  const ctaLabel = !container
    ? 'Pick a container'
    : totalPicked < 1
    ? 'Add kakanin'
    : !sellingPriceValid
    ? 'Set a price'
    : 'Add to Order';

  return (
    <div className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
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
            <h3 className="text-base font-bold text-secondary leading-tight">Assorted Kakanin</h3>
            <p className="text-xs text-secondary/50">Pick a container, add any kakanin, set one price</p>
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
            {/* Step 1: container */}
            <div className="px-5 pt-4 pb-3 border-b border-secondary/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-bundle/15 text-bundle text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Container</span>
              </div>
              {containers.length === 0 ? (
                <p className="text-xs text-secondary/50 py-1.5">
                  No containers configured. Set them up in Inventory → Bundles → Assorted Kakanin.
                </p>
              ) : (
                <ContainerSelect containers={containers} value={containerId} onChange={setContainerId} />
              )}
            </div>

            {/* Step 2: kakanin */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-bundle/15 text-bundle text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Kakanin</span>
                </div>
                {totalPicked > 0 && (
                  <span className="text-xs font-semibold text-bundle tabular-nums">
                    {totalPicked} pc{totalPicked === 1 ? '' : 's'} · {distinctPicked} kind{distinctPicked === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search kakanin…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-secondary/15 focus:outline-none focus:ring-2 focus:ring-bundle/40 focus:border-bundle"
                />
              </div>
            </div>

            {/* Kakanin grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2 min-h-0">
              {kakaninItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-secondary/40 gap-2">
                  <LogoIcon className="w-10 h-10 opacity-15" />
                  <p className="text-xs">{allKakanin.length === 0 ? 'No kakanin available' : 'No matches'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {kakaninItems.map(item => {
                    const qty = picks[item.id] ?? 0;
                    const active = qty > 0;
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
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/8 text-secondary text-lg font-bold disabled:opacity-30 hover:bg-secondary/15 active:scale-90 transition-all"
                          >
                            −
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={qty === 0 ? '' : String(qty)}
                            onChange={e => { if (/^\d*$/.test(e.target.value)) setQty(item, parseInt(e.target.value || '0', 10)); }}
                            onFocus={e => e.target.select()}
                            placeholder="0"
                            aria-label={`${item.name} quantity`}
                            className={`flex-1 min-w-0 h-8 text-center text-sm font-bold tabular-nums bg-transparent border border-secondary/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-bundle ${active ? 'text-bundle' : 'text-secondary/40'}`}
                          />
                          <button
                            onClick={() => increment(item)}
                            aria-label={`Add one ${item.name}`}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-bundle/15 text-bundle text-lg font-bold hover:bg-bundle/25 active:scale-90 transition-all"
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
                <label htmlFor="assorted-price" className="text-sm font-semibold text-secondary shrink-0">Selling price</label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/50">₱</span>
                  <input
                    id="assorted-price"
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
                <label htmlFor="assorted-grab" className="text-sm font-semibold text-secondary shrink-0">
                  Grab price <span className="text-secondary/40 font-normal">(optional)</span>
                </label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/50">₱</span>
                  <input
                    id="assorted-grab"
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
