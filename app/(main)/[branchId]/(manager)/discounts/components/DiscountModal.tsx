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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'fixed' as 'percentage' | 'fixed',
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
        type: discount.type,
        value: discount.value,
        status: discount.status
      });
      setValueInput(discount.value > 0 ? discount.value.toString() : '');
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

    if (formData.value <= 0) {
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
              options={["FIXED AMOUNT", "PERCENTAGE"]}
              hasAllOptionsVisible={false}
              defaultValue={formData.type === 'percentage' ? "PERCENTAGE" : "FIXED AMOUNT"}
              dropdownPosition='bottom-right'
              dropdownOffset={{ top: 2, right: 0 }}
              onChange={(e) => {
                const type = e === "PERCENTAGE" ? 'percentage' : 'fixed';
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

          {/* Value */}
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
