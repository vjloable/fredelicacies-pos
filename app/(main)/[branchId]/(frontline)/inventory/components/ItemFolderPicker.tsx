'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Category, InventoryItem } from '@/types/domain';

interface ItemFolderPickerProps {
  items: InventoryItem[];
  categories: Category[];
  onSelect: (item: InventoryItem) => void;
  placeholder: string;
}

// A category-driven "folder" browser for picking an inventory item — categories act as
// folders so the cashier can tap through instead of typing the exact kakanin name; a
// search box is still available for when typing is faster.
//
// The dropdown is portaled to document.body (position: fixed), matching DropdownField's
// approach — an absolutely-positioned dropdown would get clipped by any scrollable
// ancestor (e.g. the variant list in AddBundleModal's group mode).
export default function ItemFolderPicker({ items, categories, onSelect, placeholder }: ItemFolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closePicker = () => {
    setOpen(false);
    setSearch('');
    setActiveCategoryId('all');
  };

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      zIndex: 9999,
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    calcPosition();
    window.addEventListener('scroll', calcPosition, true);
    window.addEventListener('resize', calcPosition);
    return () => {
      window.removeEventListener('scroll', calcPosition, true);
      window.removeEventListener('resize', calcPosition);
    };
  }, [open, calcPosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const categoryIdsOf = (item: InventoryItem): string[] =>
    item.category_ids?.length ? item.category_ids : item.category_id ? [item.category_id] : [];

  const categoriesWithItems = categories.filter(cat => items.some(i => categoryIdsOf(i).includes(cat.id)));
  const uncategorizedCount = items.filter(i => categoryIdsOf(i).length === 0).length;

  const filteredItems = items.filter(item => {
    const catIds = categoryIdsOf(item);
    const matchesCategory =
      activeCategoryId === 'all' ? true :
      activeCategoryId === 'uncategorized' ? catIds.length === 0 :
      catIds.includes(activeCategoryId);
    const matchesSearch = search === '' || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePick = (item: InventoryItem) => {
    onSelect(item);
    closePicker();
  };

  const pillClass = (active: boolean) =>
    `shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
      active ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-secondary/20 hover:border-secondary/40'
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePicker() : setOpen(true))}
        className="w-full min-h-9.5 px-3 py-2 text-3 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent flex items-center justify-between text-left bg-white text-secondary/40 hover:border-secondary/40 transition-colors"
      >
        <span>{placeholder}</span>
        <svg className={`w-4 h-4 text-secondary/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && mounted && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="bg-white border border-secondary/20 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-secondary/10">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full px-2.5 py-1.5 text-xs border border-secondary/20 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {categoriesWithItems.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-2 overflow-x-auto border-b border-secondary/10">
              <button type="button" onClick={() => setActiveCategoryId('all')} className={pillClass(activeCategoryId === 'all')}>
                All
              </button>
              {categoriesWithItems.map(cat => (
                <button type="button" key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={pillClass(activeCategoryId === cat.id)}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color?.trim() || '#6B7280' }} />
                  {cat.name}
                </button>
              ))}
              {uncategorizedCount > 0 && (
                <button type="button" onClick={() => setActiveCategoryId('uncategorized')} className={pillClass(activeCategoryId === 'uncategorized')}>
                  Uncategorized
                </button>
              )}
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <p className="text-xs text-secondary/40 text-center py-4">No items found</p>
            ) : (
              filteredItems.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handlePick(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/5 text-left text-xs text-secondary transition-colors"
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
