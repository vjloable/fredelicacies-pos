'use client';

import React, { useState, useEffect } from 'react';
import { Discount } from '@/services/discountService';
import { createDiscount, updateDiscount } from '@/services/discountService';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import DiscountsIcon from '@/components/icons/SidebarNav/DiscountsIcon';
import DropdownField from '@/components/DropdownField';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount?: Discount | null;
  onSuccess?: () => void;
}

export default function DiscountModal({ isOpen, onClose, discount, onSuccess }: DiscountModalProps) {
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
    } else {
      setFormData({
        name: '',
        type: 'fixed',
        value: 0,
        status: 'active'
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

    try {
      if (discount) {
        // Update existing discount
        const { error } = await updateDiscount(discount.id, {
          name: formData.name.trim(),
          type: formData.type,
          value: formData.value,
          status: formData.status
        });
        if (error) throw error;
      } else {
        // Create new discount
        const { error } = await createDiscount(currentBranch.id, {
          name: formData.name.trim(),
          type: formData.type,
          value: formData.value,
          status: formData.status
        });
        if (error) throw error;
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
          <div className="w-16 h-16 bg-(--light-accent) rounded-xl mx-auto mb-4 flex items-center justify-center">
            <DiscountsIcon className='text-accent'/>
          </div>
          <h3 className="text-xl font-bold text-secondary mb-2">
            {discount ? 'Edit Discount' : 'Create New Discount'}
          </h3>
          <p className="text-secondary opacity-70">
            {discount ? 'Edit the details of the discount' : 'Create a new discount code'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Discount Name */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Discount Name <span className="text-(--error)">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-(--secondary)/30 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., SAVE20, WELCOME10"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Discount Type <span className="text-(--error)">*</span>
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
              roundness={"[6px]"}
              height={42}
              valueAlignment={"left"}
              padding=''
              shadow={false}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Status <span className="text-(--error)">*</span>
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
              roundness={"[6px]"}
              height={42}
              valueAlignment={"left"}
              padding=''
              shadow={false}
            />
            <p className="text-sm text-(--secondary)/50 mt-1">
              Active discounts are available for use at checkout
            </p>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Discount Value <span className="text-(--error)">*</span>
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
                className="w-full px-3 py-2 border border-(--secondary)/30 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={formData.type === 'percentage' ? '10' : '100'}
                inputMode="decimal"
                required
              />
              <span className="absolute right-3 top-2 text-(--secondary)/50">
                {formData.type === 'percentage' ? '%' : '₱'}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-(--secondary)/30 text-secondary rounded-md hover:bg-(--accent)/50 focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-(--accent)/50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
