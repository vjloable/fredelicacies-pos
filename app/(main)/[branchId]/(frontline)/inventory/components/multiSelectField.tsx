'use client';

import { useState, useMemo } from 'react';
import SafeImage from '@/components/SafeImage';
import type { Category, InventoryItem } from '@/types/domain';

// Items belonging to a category identified by name (case-insensitive).
export function itemsInCategory(
  inventory: InventoryItem[],
  categories: Category[],
  categoryName: string
): InventoryItem[] {
  const catIds = categories
    .filter(c => c.name.trim().toUpperCase() === categoryName.trim().toUpperCase())
    .map(c => c.id);
  if (catIds.length === 0) return [];
  return inventory.filter(item => {
    const ids = item.category_ids?.length
      ? item.category_ids
      : item.category_id
      ? [item.category_id]
      : [];
    return ids.some(id => catIds.includes(id));
  });
}

// A multi-select field: chosen items shown as chips + a searchable checkbox list.
export function MultiSelectField({
  label,
  emptyHint,
  items,
  selected,
  onToggle,
}: {
  label: string;
  emptyHint: string;
  items: InventoryItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );
  const selectedItems = items.filter(i => selected.has(i.id));

  return (
    <div>
      <label className="text-3 text-secondary/60 font-medium block mb-1.5">{label}</label>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border border-secondary/20 bg-white hover:border-secondary/40 transition-colors"
      >
        <span className="text-secondary/70">
          {selectedItems.length > 0
            ? `${selectedItems.length} selected`
            : `Select ${label.toLowerCase()}…`}
        </span>
        <svg className={`w-4 h-4 text-secondary/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chips of the current selection */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedItems.map(item => (
            <span key={item.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-bundle/10 text-bundle text-[11px] font-medium">
              {item.name}
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onToggle(item.id)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-bundle/20"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 border border-secondary/15 rounded-lg overflow-hidden">
          <div className="p-2 border-b border-secondary/10">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-bundle/50"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-secondary/40 text-center py-6 px-3">{emptyHint}</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-secondary/40 text-center py-6">No matches</p>
            ) : (
              filtered.map(item => {
                const checked = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      checked ? 'bg-bundle/5' : 'hover:bg-secondary/5'
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                      checked ? 'bg-bundle border-bundle text-white' : 'border-secondary/30'
                    }`}>
                      {checked && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="relative w-7 h-7 rounded bg-secondary/5 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.img_url && <SafeImage src={item.img_url} alt={item.name} />}
                    </span>
                    <span className="text-xs text-secondary truncate flex-1 min-w-0">{item.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
