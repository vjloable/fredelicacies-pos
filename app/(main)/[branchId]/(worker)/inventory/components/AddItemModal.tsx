'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import LoadingSpinner from "@/components/LoadingSpinner";
import ImageUpload from '@/components/ImageUpload';
import { createInventoryItem } from '@/services/inventoryService';
import type { Category, CreateInventoryItemData, InventoryUnitType, InventoryItemKind } from '@/types/domain';
import PlusIcon from '@/components/icons/PlusIcon';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/services/activityLogService';

// Units of measure available per family for commissary ingredients.
const UNIT_OPTIONS: Record<InventoryUnitType, string[]> = {
  liquid: ['L', 'oz'],
  solid: ['g'],
  piece: ['pcs'],
};
const UNIT_TYPE_LABEL: Record<InventoryUnitType, string> = {
  liquid: 'Liquid',
  solid: 'Solid',
  piece: 'Piece',
};

// The commissary add-item wizard forks on what the user is creating.
const KIND_META: Record<InventoryItemKind, { label: string; desc: string; icon: React.ReactNode }> = {
  item: {
    label: 'Item',
    desc: 'Internal supply or equipment you only need to keep stock of.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
      </svg>
    ),
  },
  product: {
    label: 'Product',
    desc: 'A finished good you sell or send out to branches.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  ingredient: {
    label: 'Ingredient',
    desc: 'A raw material measured by volume, weight, or pieces.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
  },
};
const KIND_ORDER: InventoryItemKind[] = ['item', 'product', 'ingredient'];

interface AddItemModalProps {
  isOpen: boolean;
  categories: Category[];
  initialCategoryId?: string;
  onClose: () => void;
  onError: (error: string) => void;
}

export default function AddItemModal({
  isOpen,
  categories,
  initialCategoryId,
  onClose,
  onError
}: AddItemModalProps) {
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    stock: 0,
    description: "",
    img_url: ""
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [stockInput, setStockInput] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // The Item / Product / Ingredient wizard applies to selling branches, events, and the commissary.
  const useKindWizard = currentBranch?.type === 'commissary' || currentBranch?.type === 'branch' || currentBranch?.type === 'event';

  // Wizard: the user first picks a kind (Item / Product / Ingredient), then fills the tailored form.
  const [kind, setKind] = useState<InventoryItemKind | null>(null);
  const effectiveKind: InventoryItemKind = useKindWizard ? (kind ?? 'item') : 'item';
  const showChoice = useKindWizard && kind === null;
  const isIngredient = effectiveKind === 'ingredient';

  // Ingredient unit of measure.
  const [unitType, setUnitType] = useState<InventoryUnitType | ''>('');
  const [unit, setUnit] = useState('');
  const [measurementInput, setMeasurementInput] = useState('');

  const selectUnitType = (t: InventoryUnitType) => {
    setUnitType(t);
    setUnit(UNIT_OPTIONS[t][0]);
  };

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryDropdownOpen]);

  // Start each open at the choice step (commissary) and pre-seed category from a folder.
  useEffect(() => {
    if (!isOpen) return;
    setKind(null);
    if (initialCategoryId) setSelectedCategoryIds([initialCategoryId]);
  }, [isOpen, initialCategoryId]);

  if (!isOpen) return null;

  const resetForm = () => {
    setNewItem({ name: "", stock: 0, description: "", img_url: "" });
    setSelectedCategoryIds([]);
    setStockInput('');
    setKind(null);
    setUnitType('');
    setUnit('');
    setMeasurementInput('');
  };

  const chooseKind = (k: InventoryItemKind) => {
    setKind(k);
    if (k !== 'ingredient') {
      setUnitType('');
      setUnit('');
      setMeasurementInput('');
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) return;

    const finalStock = stockInput === '' ? 0 : parseInt(stockInput);
    if (isNaN(finalStock) || finalStock < 0) {
      onError('Please enter a valid stock amount');
      return;
    }

    // Ingredients must declare a unit of measure and measurement.
    let measurement: number | undefined;
    if (isIngredient) {
      if (!unitType) {
        onError('Please choose a measurement type');
        return;
      }
      measurement = parseFloat(measurementInput);
      if (!Number.isFinite(measurement) || measurement <= 0) {
        onError('Please enter a valid measurement');
        return;
      }
    }

    setLoading(true);
    try {
      const itemData: CreateInventoryItemData = {
        name: newItem.name,
        category_ids: selectedCategoryIds,
        category_id: selectedCategoryIds[0] || undefined,
        stock: finalStock,
        description: newItem.description || undefined,
        img_url: newItem.img_url || undefined,
        kind: effectiveKind,
        ...(isIngredient
          ? { is_custom: true, unit_type: unitType as InventoryUnitType, unit, measurement }
          : {}),
      };

      await createInventoryItem(currentBranch!.id, itemData);
      void logActivity({ branchId: currentBranch!.id, userId: user?.id ?? null, action: 'item_created', entityType: 'inventory', details: { name: newItem.name, kind: effectiveKind, categories: selectedCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean) } });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error adding item:', error);
      onError('Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const meta = KIND_META[effectiveKind];
  const customIncomplete = isIngredient && (!unitType || !measurementInput || parseFloat(measurementInput) <= 0);
  const canAdd = !!newItem.name.trim() && !customIncomplete;

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-2xl w-full mx-4 shadow-xl max-h-[85vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <LoadingSpinner size="lg" />
            <div className="text-center">
              <p className="text-sm font-semibold text-secondary">Adding {KIND_META[effectiveKind].label}...</p>
              <p className="text-xs text-secondary/50">Please wait</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {showChoice ? (
              <motion.div
                key="choose"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18 }}
              >
                {/* Choice step */}
                <div className="mb-2">
                  <h3 className="text-base font-bold text-secondary">Add to inventory</h3>
                  <p className="text-xs text-secondary/50 mt-0.5">What are you creating?</p>
                </div>

                {/* Full-bleed to the modal edges; rows re-pad their content to align with the rest. */}
                <div className="-mx-5 divide-y divide-secondary/10 border-y border-secondary/10">
                  {KIND_ORDER.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => chooseKind(k)}
                      className="group w-full flex items-center gap-4 py-4 px-5 text-left transition-colors hover:bg-accent/5 focus-visible:outline-none"
                    >
                      <span className="shrink-0 w-6 flex justify-center text-secondary/40 transition-colors group-hover:text-accent">
                        {KIND_META[k].icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-secondary transition-colors group-hover:text-accent">{KIND_META[k].label}</span>
                        <span className="block text-xs text-secondary/45 leading-snug mt-0.5">{KIND_META[k].desc}</span>
                      </span>
                      <svg className="w-4 h-4 shrink-0 text-secondary/20 transition-all group-hover:text-accent group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>

                <button
                  onClick={onClose}
                  className="block ml-auto mt-4 px-2 py-1.5 text-xs font-semibold text-secondary/50 hover:text-secondary transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={`form-${effectiveKind}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.18 }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  {useKindWizard && (
                    <button
                      onClick={() => setKind(null)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/10 transition-colors text-secondary/60"
                      title="Back"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-xl border border-accent/30 flex items-center justify-center shrink-0 text-accent">
                    {useKindWizard ? meta.icon : <PlusIcon className="size-5 text-accent" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-secondary">
                      {useKindWizard ? `New ${meta.label}` : 'Add New Item'}
                    </h3>
                    <p className="text-xs text-secondary opacity-70 truncate">
                      {useKindWizard ? meta.desc : 'Create a new item for your inventory'}
                    </p>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-2">
                        {meta.label} Name <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder={`Enter ${meta.label.toLowerCase()} name`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-2">
                        Description
                        <span className="text-xs text-secondary/50 ml-1">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Enter description"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-2">
                        Initial Stock <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={stockInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^[0-9]*$/.test(value)) {
                            setStockInput(value);
                            if (value !== '' && !isNaN(parseInt(value))) {
                              setNewItem({ ...newItem, stock: parseInt(value) });
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                        }}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => {
                          if (stockInput === '' || isNaN(parseInt(stockInput))) {
                            setNewItem({ ...newItem, stock: 0 });
                            setStockInput('');
                          }
                        }}
                        className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="0"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-2">
                        Categories
                        <span className="text-xs text-secondary/50 ml-1">(Optional)</span>
                      </label>
                      <div className="relative" ref={categoryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setCategoryDropdownOpen(o => !o)}
                          className="w-full min-h-9.5 px-3 py-1.5 text-3 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent flex items-center flex-wrap gap-1.5 text-left bg-white"
                        >
                          {selectedCategoryIds.length === 0 ? (
                            <span className="text-secondary/40 text-3">Select categories...</span>
                          ) : (
                            selectedCategoryIds.map(id => {
                              const cat = categories.find(c => c.id === id);
                              if (!cat) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color?.trim() || '#6B7280' }} />
                                  {cat.name}
                                  <span
                                    onClick={(e) => { e.stopPropagation(); setSelectedCategoryIds(prev => prev.filter(i => i !== id)); }}
                                    className="ml-0.5 hover:text-error cursor-pointer leading-none"
                                  >×</span>
                                </span>
                              );
                            })
                          )}
                          <svg className={`w-4 h-4 text-secondary/40 ml-auto shrink-0 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {categoryDropdownOpen && (
                          <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-white border border-secondary/20 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                            {categories.map(cat => (
                              <label
                                key={cat.id}
                                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 border-secondary/10 select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedCategoryIds.includes(cat.id)}
                                  onChange={() => setSelectedCategoryIds(prev =>
                                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                  )}
                                  className="w-3.5 h-3.5 rounded shrink-0 accent-accent"
                                />
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color?.trim() || '#6B7280' }} />
                                <span className="text-xs text-secondary">{cat.name}</span>
                              </label>
                            ))}
                            {categories.length === 0 && (
                              <p className="text-xs text-secondary/50 text-center py-2">No categories available</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ingredient unit of measure */}
                  {isIngredient && (
                    <div className="rounded-lg border border-bundle/30 bg-bundle/5 p-3">
                      <p className="text-xs font-semibold text-secondary mb-3">Unit of measure</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-secondary mb-2">
                            Type <span className="text-error">*</span>
                          </label>
                          <div className="flex gap-1.5">
                            {(Object.keys(UNIT_OPTIONS) as InventoryUnitType[]).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => selectUnitType(t)}
                                className={`flex-1 py-1.5 rounded-md text-2.5 font-semibold border transition-colors ${
                                  unitType === t
                                    ? 'bg-bundle text-primary border-bundle'
                                    : 'bg-white text-secondary border-secondary/20 hover:border-secondary/40'
                                }`}
                              >
                                {UNIT_TYPE_LABEL[t]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-secondary mb-2">
                            Unit <span className="text-error">*</span>
                          </label>
                          <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            disabled={!unitType}
                            className="w-full px-3 h-9.5 text-3 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-bundle disabled:bg-gray-50 disabled:text-secondary/30"
                          >
                            {(unitType ? UNIT_OPTIONS[unitType] : []).map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-secondary mb-2">
                            Measurement <span className="text-error">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={measurementInput}
                              onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setMeasurementInput(e.target.value); }}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className="w-full px-3 pr-10 h-9.5 text-3 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-bundle"
                            />
                            {unit && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2.5 text-secondary/50 pointer-events-none">{unit}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Upload */}
                <ImageUpload
                  currentImageUrl={newItem.img_url}
                  onImageUpload={(imageUrl) => setNewItem({ ...newItem, img_url: imageUrl })}
                  onImageRemove={() => setNewItem({ ...newItem, img_url: "" })}
                  bucket="inventory-images"
                  compact
                />

                {/* Action Buttons */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={useKindWizard ? () => setKind(null) : onClose}
                    className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    {useKindWizard ? 'Back' : 'Cancel'}
                  </button>
                  <button
                    onClick={addItem}
                    disabled={!canAdd}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                      canAdd
                        ? 'bg-accent hover:bg-accent text-primary text-shadow-lg hover:scale-105 cursor-pointer'
                        : 'bg-gray-100 text-secondary/50 hover:scale-100 active:scale-100 cursor-not-allowed'
                    }`}
                  >
                    Add {useKindWizard ? meta.label : 'Item'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
