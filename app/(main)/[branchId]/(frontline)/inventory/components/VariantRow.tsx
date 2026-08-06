'use client';

import { useState } from 'react';
import type { Category, InventoryItem } from '@/types/domain';
import ItemFolderPicker from './ItemFolderPicker';
import QuantityStepper from './QuantityStepper';

export interface VariantComponentDraft {
  inventoryItemId: string;
  quantity: number;
  item: InventoryItem;
}

export interface VariantDraft {
  key: string;
  id?: string;
  variantLabel: string;
  price: string;
  grabPrice: string;
  components: VariantComponentDraft[];
}

interface VariantRowProps {
  variant: VariantDraft;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
  inventory: InventoryItem[];
  categories: Category[];
}

// One size/prefix row within a single-type bundle group — e.g.
// "Small - 50pcs - Round container" with its own price, grab price, and
// component list (kakanin quantity + container, both explicit per variant).
export default function VariantRow({
  variant,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  inventory,
  categories,
}: VariantRowProps) {
  const [pendingRemove, setPendingRemove] = useState(false);

  const availableItems = inventory.filter(
    item => !variant.components.find(c => c.inventoryItemId === item.id)
  );

  const handleSelectComponent = (item: InventoryItem) => {
    if (!item.id) return;
    onChange({ components: [...variant.components, { inventoryItemId: item.id, quantity: 1, item }] });
  };

  const handleRemoveComponent = (inventoryItemId: string) => {
    onChange({ components: variant.components.filter(c => c.inventoryItemId !== inventoryItemId) });
  };

  const handleUpdateComponentQty = (inventoryItemId: string, quantity: number) => {
    onChange({
      components: variant.components.map(c =>
        c.inventoryItemId === inventoryItemId ? { ...c, quantity: Math.max(0, quantity) } : c
      ),
    });
  };

  return (
    <div className="rounded-lg border border-secondary/20 overflow-hidden">
      <div className="flex items-center gap-2 p-2.5 bg-secondary/5">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse variant' : 'Expand variant'}
          className="shrink-0 p-1 text-secondary/50 hover:text-secondary"
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <input
          type="text"
          value={variant.variantLabel}
          onChange={(e) => onChange({ variantLabel: e.target.value })}
          placeholder="e.g. Small - 50pcs - Round container"
          className="flex-1 min-w-0 px-2.5 py-1.5 text-3.5 rounded-md border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="shrink-0 text-xs text-secondary/50 tabular-nums">
          {variant.price !== '' ? `₱${variant.price}` : '—'}
        </span>
        {pendingRemove ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onRemove}
              className="px-2 py-1 text-xs font-semibold text-white bg-error rounded-md hover:bg-error/90"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setPendingRemove(false)}
              className="px-2 py-1 text-xs text-secondary/60 hover:text-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Remove variant"
            onClick={() => setPendingRemove(true)}
            className="shrink-0 p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-3 border-t border-secondary/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50">₱</span>
                <input
                  type="text"
                  value={variant.price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) onChange({ price: value });
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-8 pr-3 py-2 text-3 h-9 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Grab Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50">₱</span>
                <input
                  type="text"
                  value={variant.grabPrice}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) onChange({ grabPrice: value });
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-8 pr-3 py-2 text-3 h-9 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-2">
              Components <span className="text-error">*</span>
              <span className="text-xs text-secondary/50 ml-1 font-normal">(kakanin quantity + container)</span>
            </label>

            {availableItems.length > 0 && (
              <div className="mb-2">
                <ItemFolderPicker
                  items={availableItems}
                  categories={categories}
                  onSelect={handleSelectComponent}
                  placeholder="Add kakanin, container, etc…"
                />
              </div>
            )}

            {variant.components.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {variant.components.map((component) => (
                  <div
                    key={component.inventoryItemId}
                    className="flex items-center gap-2 p-2 bg-bundle/10 rounded-lg border border-bundle/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-secondary truncate text-3.5">{component.item.name}</div>
                      <div className="text-xs text-secondary/50">Stock: {component.item.stock}</div>
                    </div>
                    <QuantityStepper
                      value={component.quantity}
                      onChange={(next) => handleUpdateComponentQty(component.inventoryItemId, next)}
                    />
                    <button
                      aria-label="Remove component"
                      onClick={() => handleRemoveComponent(component.inventoryItemId)}
                      className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-secondary/40 text-center py-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                No components added yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
