'use client';

import React, { useState, useEffect } from 'react';
import { Discount } from '@/services/discountService';
import { createDiscount, updateDiscount } from '@/services/discountService';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToCategories } from '@/stores/dataStore';
import { Category } from '@/services/categoryService';
import DiscountsIcon from '@/components/icons/SidebarNav/DiscountsIcon';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount?: Discount | null;
  onSuccess?: () => void;
}

export default function DiscountModal({ isOpen, onClose, discount, onSuccess }: DiscountModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [valueInput, setValueInput] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    discount_code: '',
    type: 'flat' as 'percentage' | 'flat',
    value: 0,
    applies_to: null as string | null
  });

  // Load categories
  useEffect(() => {
    const unsubscribe = subscribeToCategories((categories) => {
      setCategories(categories);
    });

    return unsubscribe;
  }, []);

  // Initialize form data when discount prop changes
  useEffect(() => {
    if (discount) {
      setFormData({
        discount_code: discount.discount_code,
        type: discount.type,
        value: discount.value,
        applies_to: discount.applies_to
      });
      setValueInput(discount.value > 0 ? discount.value.toString() : '');
    } else {
      setFormData({
        discount_code: '',
        type: 'flat',
        value: 0,
        applies_to: null
      });
      setValueInput('');
    }
  }, [discount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Debug user object
    console.log('User object:', user);
    console.log('User UID:', user?.uid);
    console.log('Is user authenticated:', !!user);
    
    if (!user || !user.uid) {
      alert('You must be logged in to create/update discounts');
      return;
    }

    if (!formData.discount_code.trim()) {
      alert('Please enter a discount code');
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

    try {
      if (discount) {
        // Update existing discount
        await updateDiscount(discount.discount_code, {
          type: formData.type,
          value: formData.value,
          applies_to: formData.applies_to,
          modified_by: user.uid
        });
      } else {
        // Create new discount
        await createDiscount({
          discount_code: formData.discount_code.trim().toUpperCase(), // Ensure uppercase and trimmed
          type: formData.type,
          value: formData.value,
          applies_to: formData.applies_to,
          created_by: user.uid
        });
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
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-4">
        </h2>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[var(--light-accent)] rounded-xl mx-auto mb-4 flex items-center justify-center">
            <DiscountsIcon className='text-[var(--accent)]'/>
          </div>
          <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
            {discount ? 'Edit Discount' : 'Create New Discount'}
          </h3>
          <p className="text-[var(--secondary)] opacity-70">
            {discount ? 'Edit the details of the discount' : 'Create a new discount code'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Discount Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Code *
            </label>
            <input
              type="text"
              value={formData.discount_code}
              onChange={(e) => handleInputChange('discount_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., SAVE20, WELCOME10"
              disabled={!!discount} // Can't change discount code for existing discounts
              required
            />
            {discount && (
              <p className="text-sm text-gray-500 mt-1">
                Discount code cannot be changed
              </p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="flat">Flat Amount</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Value *
            </label>
            <div className="relative">
              <input
                type="text"
                value={valueInput}
                onChange={(e) => {
                  const value = e.target.value;
                  
                  // Only allow digits and one decimal point
                  if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                    setValueInput(value);
                    
                    // Update the actual value if it's a valid number
                    if (value !== '' && !isNaN(parseFloat(value))) {
                      const numValue = parseFloat(value);
                      // For percentage, limit to 100
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
                  // Prevent scientific notation
                  if (['e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onFocus={(e) => {
                  e.target.select();
                }}
                onBlur={() => {
                  // If empty or invalid, set to 0
                  if (valueInput === '' || isNaN(parseFloat(valueInput))) {
                    setFormData(prev => ({ ...prev, value: 0 }));
                    setValueInput('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={formData.type === 'percentage' ? '10' : '100'}
                inputMode="decimal"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">
                {formData.type === 'percentage' ? '%' : '$'}
              </span>
            </div>
          </div>

          {/* Applies To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applies To
            </label>
            <select
              value={formData.applies_to || ''}
              onChange={(e) => handleInputChange('applies_to', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Items</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Leave as {"All Items"} to apply discount to entire order
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
