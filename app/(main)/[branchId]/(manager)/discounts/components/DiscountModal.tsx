'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Discount } from '@/services/discountService';
import { createDiscount, updateDiscount } from '@/services/discountService';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { logActivity } from '@/services/activityLogService';
import DiscountsIcon from '@/components/icons/SidebarNav/DiscountsIcon';
import DropdownField from '@/components/DropdownField';
import type { Category } from '@/types/domain';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount?: Discount | null;
  onSuccess?: () => void;
  categories: Category[];
}

export default function DiscountModal({ isOpen, onClose, discount, onSuccess, categories }: DiscountModalProps) {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [valueInput, setValueInput] = useState('');
  const [scPwdDiscountPct, setScPwdDiscountPct] = useState('20');
  const [scPwdVatRate, setScPwdVatRate] = useState('12');
  const [scPwdApplyVat, setScPwdApplyVat] = useState(true);
  const [scPwdMostExpensive, setScPwdMostExpensive] = useState(true);
  const [scPwdTooltipOpen, setScPwdTooltipOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'fixed' as 'percentage' | 'fixed' | 'b1t1' | 'sc_pwd',
    value: 0,
    status: 'active' as 'active' | 'inactive'
  });

  // Category filter state
  const [filterMode, setFilterMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close category dropdown on outside click
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    }
    if (categoryDropdownOpen) {
      document.addEventListener('mousedown', handleDown);
      return () => document.removeEventListener('mousedown', handleDown);
    }
  }, [categoryDropdownOpen]);

  // Initialize form data when discount prop changes
  useEffect(() => {
    if (discount) {
      setFormData({
        name: discount.name,
        type: discount.type as 'percentage' | 'fixed' | 'b1t1' | 'sc_pwd',
        value: discount.value,
        status: discount.status
      });
      setValueInput(discount.value > 0 ? discount.value.toString() : '');
      setScPwdDiscountPct(discount.metadata?.discount_pct?.toString() ?? '20');
      setScPwdVatRate(discount.metadata?.vat_rate?.toString() ?? '12');
      setScPwdApplyVat(discount.metadata?.apply_vat !== false);
      setScPwdMostExpensive(discount.metadata?.most_expensive_only !== false);
      setFilterMode(discount.category_filter_mode ?? 'all');
      setFilterCategoryIds(discount.category_filter_ids ?? []);
    } else {
      setFormData({
        name: '',
        type: 'fixed',
        value: 0,
        status: 'active'
      });
      setValueInput('');
      setScPwdDiscountPct('20');
      setScPwdVatRate('12');
      setScPwdApplyVat(true);
      setScPwdMostExpensive(true);
      setFilterMode('all');
      setFilterCategoryIds([]);
    }
  }, [discount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !user.uid) {
      alert('You must be logged in to create/update discounts');
      return;
    }

    if (!currentBranch?.id) {
      alert('No branch selected. Please select a branch first.');
      return;
    }

    if (!formData.name.trim()) {
      alert('Please enter a discount name');
      return;
    }

    if (formData.type !== 'b1t1' && formData.type !== 'sc_pwd' && formData.value <= 0) {
      alert('Please enter a valid discount value');
      return;
    }

    if (formData.type === 'percentage' && formData.value > 100) {
      alert('Percentage discount cannot exceed 100%');
      return;
    }

    setLoading(true);

    const categoryFilterMode = filterMode === 'all' ? null : filterMode;
    const categoryFilterIds = filterMode === 'all' || filterCategoryIds.length === 0 ? null : filterCategoryIds;

    try {
      if (discount) {
        const { error } = await updateDiscount(discount.id, {
          name: formData.name.trim(),
          type: formData.type,
          value: formData.value,
          status: formData.status,
          category_filter_mode: categoryFilterMode,
          category_filter_ids: categoryFilterIds,
          metadata: formData.type === 'sc_pwd' ? { discount_pct: parseFloat(scPwdDiscountPct) || 20, vat_rate: parseFloat(scPwdVatRate) || 12, apply_vat: scPwdApplyVat, most_expensive_only: scPwdMostExpensive } : null,
        });
        if (error) throw error;
        void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'discount_updated', entityType: 'discount', entityId: discount.id, details: { name: formData.name.trim(), type: formData.type, value: formData.value } });
      } else {
        const { id, error } = await createDiscount(currentBranch.id, {
          name: formData.name.trim(),
          type: formData.type,
          value: formData.value,
          status: formData.status,
          category_filter_mode: categoryFilterMode,
          category_filter_ids: categoryFilterIds,
          metadata: formData.type === 'sc_pwd' ? { discount_pct: parseFloat(scPwdDiscountPct) || 20, vat_rate: parseFloat(scPwdVatRate) || 12, apply_vat: scPwdApplyVat, most_expensive_only: scPwdMostExpensive } : null,
        });
        if (error) throw error;
        void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'discount_created', entityType: 'discount', entityId: id ?? undefined, details: { name: formData.name.trim(), type: formData.type, value: formData.value } });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving discount:', error);
      alert(`Failed to ${discount ? 'update' : 'create'} discount. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
        </h2>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-light-accent rounded-xl mx-auto mb-4 flex items-center justify-center">
            <DiscountsIcon className='text-accent'/>
          </div>
          <h3 className="text-lg font-bold text-secondary mb-2">
            {discount ? 'Edit Discount' : 'Create New Discount'}
          </h3>
          <p className="text-secondary opacity-70">
            {discount ? 'Edit the details of the discount' : 'Create a new discount code'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Discount Name */}
          <div>
            <label className="block text-xs font-medium text-secondary/70 mb-1">
              Discount Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 text-3 h-9.5 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="e.g., SAVE20, WELCOME10"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-secondary/70 mb-1">
              Discount Type <span className="text-error">*</span>
            </label>
            <DropdownField
              options={["FIXED AMOUNT", "PERCENTAGE", "BUY 1 TAKE 1", "SC/PWD"]}
              hasAllOptionsVisible={false}
              defaultValue={formData.type === 'percentage' ? "PERCENTAGE" : formData.type === 'b1t1' ? "BUY 1 TAKE 1" : formData.type === 'sc_pwd' ? "SC/PWD" : "FIXED AMOUNT"}
              dropdownPosition='bottom-right'
              dropdownOffset={{ top: 2, right: 0 }}
              onChange={(e) => {
                const type = e === "PERCENTAGE" ? 'percentage' : e === "BUY 1 TAKE 1" ? 'b1t1' : e === "SC/PWD" ? 'sc_pwd' : 'fixed';
                handleInputChange('type', type);
              }}
              roundness="8"
              height={38}
              valueAlignment={"left"}
              padding='12px'
              shadow={false}
              borderClassName="border-2 border-secondary/20"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-secondary/70 mb-1">
              Status <span className="text-error">*</span>
            </label>
            <DropdownField
              options={["ACTIVE", "INACTIVE"]}
              hasAllOptionsVisible={false}
              defaultValue={formData.status === 'active' ? "ACTIVE" : "INACTIVE"}
              dropdownPosition='bottom-right'
              dropdownOffset={{ top: 2, right: 0 }}
              onChange={(e) => {
                const status = e === "ACTIVE" ? 'active' : 'inactive';
                handleInputChange('status', status);
              }}
              roundness="8"
              height={38}
              valueAlignment={"left"}
              padding='12px'
              shadow={false}
              borderClassName="border-2 border-secondary/20"
            />
            <p className="text-xs text-secondary/50 mt-1">
              Active discounts are available for use at checkout
            </p>
          </div>

          {/* SC/PWD fields */}
          {formData.type === 'sc_pwd' && (
            <div className="space-y-3">
              {/* Tooltip banner — always visible */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setScPwdTooltipOpen(o => !o)}
                  className="w-full flex items-start gap-2 px-3 py-2.5 bg-accent/10 border border-accent/30 rounded-lg text-left"
                >
                  <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs text-accent font-medium leading-snug">
                    SC/PWD computation uses VAT exemption + percentage off.
                    <span className="underline ml-1">Tap to see formula.</span>
                  </span>
                </button>
                {scPwdTooltipOpen && (
                  <div className="mt-1 px-3 py-2.5 bg-secondary/5 border border-secondary/15 rounded-lg text-xs text-secondary/70 space-y-1 leading-relaxed">
                    {scPwdApplyVat && scPwdMostExpensive && (
                      <>
                        <p className="font-semibold text-secondary">Most expensive item · VAT-exempt + {scPwdDiscountPct || 20}% off</p>
                        <p>1. Remove VAT: price ÷ (1 + {scPwdVatRate || 12}%)</p>
                        <p>2. Discount savings: ex-VAT price × {scPwdDiscountPct || 20}%</p>
                        <p>3. VAT exemption savings: price − ex-VAT price</p>
                        <p className="font-medium">Total = VAT exemption + discount savings</p>
                        <p className="text-secondary/50 italic">e.g. ₱186 ÷ 1.12 × 0.32 = ₱53.14</p>
                      </>
                    )}
                    {scPwdApplyVat && !scPwdMostExpensive && (
                      <>
                        <p className="font-semibold text-secondary">All items · VAT-exempt + {scPwdDiscountPct || 20}% off each</p>
                        <p>Each item: price ÷ (1 + {scPwdVatRate || 12}%) × ({scPwdVatRate || 12}% + {scPwdDiscountPct || 20}%)</p>
                        <p>Total savings = sum across all items</p>
                      </>
                    )}
                    {!scPwdApplyVat && scPwdMostExpensive && (
                      <>
                        <p className="font-semibold text-secondary">Most expensive item · {scPwdDiscountPct || 20}% off (no VAT exemption)</p>
                        <p>Savings = most expensive item price × {scPwdDiscountPct || 20}%</p>
                      </>
                    )}
                    {!scPwdApplyVat && !scPwdMostExpensive && (
                      <>
                        <p className="font-semibold text-secondary">All items · {scPwdDiscountPct || 20}% off (no VAT exemption)</p>
                        <p>Savings = subtotal × {scPwdDiscountPct || 20}%</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Numeric inputs */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-secondary/70 mb-1">Discount %</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={scPwdDiscountPct}
                      onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setScPwdDiscountPct(e.target.value); }}
                      onFocus={e => e.target.select()}
                      className="w-full px-3 py-2 text-3 h-9.5 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder="20"
                      inputMode="decimal"
                    />
                    <span className="absolute right-3 top-2 text-secondary/50">%</span>
                  </div>
                </div>
                {scPwdApplyVat && (
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-secondary/70 mb-1">VAT Rate %</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={scPwdVatRate}
                        onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setScPwdVatRate(e.target.value); }}
                        onFocus={e => e.target.select()}
                        className="w-full px-3 py-2 text-3 h-9.5 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                        placeholder="12"
                        inputMode="decimal"
                      />
                      <span className="absolute right-3 top-2 text-secondary/50">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scPwdApplyVat}
                    onChange={e => setScPwdApplyVat(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent shrink-0"
                  />
                  <span className="text-xs text-secondary">Apply VAT exemption</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scPwdMostExpensive}
                    onChange={e => setScPwdMostExpensive(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent shrink-0"
                  />
                  <span className="text-xs text-secondary">Apply only to the most expensive item</span>
                </label>
              </div>
            </div>
          )}

          {/* Value — hidden for b1t1/sc_pwd since price is set interactively at checkout */}
          {formData.type !== 'b1t1' && formData.type !== 'sc_pwd' && (
          <div>
            <label className="block text-xs font-medium text-secondary/70 mb-1">
              Discount Value <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={valueInput}
                onChange={(e) => {
                  const value = e.target.value;

                  if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                    setValueInput(value);

                    if (value !== '' && !isNaN(parseFloat(value))) {
                      const numValue = parseFloat(value);
                      if (formData.type === 'percentage' && numValue > 100) {
                        setValueInput('100');
                        setFormData(prev => ({ ...prev, value: 100 }));
                      } else {
                        setFormData(prev => ({ ...prev, value: numValue }));
                      }
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onFocus={(e) => {
                  e.target.select();
                }}
                onBlur={() => {
                  if (valueInput === '' || isNaN(parseFloat(valueInput))) {
                    setFormData(prev => ({ ...prev, value: 0 }));
                    setValueInput('');
                  }
                }}
                className="w-full px-3 py-2 text-3 h-9.5 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder={formData.type === 'percentage' ? '10' : '100'}
                inputMode="decimal"
                required
              />
              <span className="absolute right-3 top-2 text-secondary/50">
                {formData.type === 'percentage' ? '%' : '₱'}
              </span>
            </div>
          </div>
          )}

          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <label className="text-xs font-medium text-secondary/70 mb-1 block">
                Applies To
              </label>

              {/* Mode toggle */}
              <div className="flex rounded-lg border-2 border-secondary/20 overflow-hidden mb-2">
                {(['all', 'include', 'exclude'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setFilterMode(mode); if (mode === 'all') setFilterCategoryIds([]); }}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      filterMode === mode
                        ? 'bg-accent text-primary'
                        : 'text-secondary/60 hover:bg-secondary/5'
                    }`}
                  >
                    {mode === 'all' ? 'All Items' : mode === 'include' ? 'Include' : 'Exclude'}
                  </button>
                ))}
              </div>

              {filterMode === 'all' ? (
                <p className="text-xs text-secondary/40 italic">Applies to all items in the cart</p>
              ) : (
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen(o => !o)}
                    className="w-full min-h-9.5 px-3 py-1.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent flex items-center flex-wrap gap-1.5 text-left bg-white"
                  >
                    {filterCategoryIds.length === 0 ? (
                      <span className="text-secondary/40 text-3">
                        {filterMode === 'include' ? 'Select categories to include...' : 'Select categories to exclude...'}
                      </span>
                    ) : (
                      filterCategoryIds.map(id => {
                        const cat = categories.find(c => c.id === id);
                        if (!cat) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color?.trim() || '#6B7280' }} />
                            {cat.name}
                            <span
                              onClick={(e) => { e.stopPropagation(); setFilterCategoryIds(prev => prev.filter(i => i !== id)); }}
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
                    <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-white border-2 border-secondary/20 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                      {categories.map(cat => (
                        <label key={cat.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 border-secondary/10 select-none">
                          <input
                            type="checkbox"
                            checked={filterCategoryIds.includes(cat.id)}
                            onChange={() => setFilterCategoryIds(prev =>
                              prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                            )}
                            className="w-3.5 h-3.5 rounded shrink-0 accent-accent"
                          />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color?.trim() || '#6B7280' }} />
                          <span className="text-xs text-secondary">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {filterCategoryIds.length === 0 && (
                    <p className="text-xs text-secondary/40 italic mt-1">
                      No categories selected — applies to all items
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-secondary/30 text-secondary rounded-md hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : (discount ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
