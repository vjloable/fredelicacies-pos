'use client';

import React, { useState, useEffect } from 'react';
import TopBar from "@/components/TopBar";
import { Discount, deleteDiscount } from '@/services/discountService';
import { subscribeToDiscounts } from '@/stores/dataStore';
import { subscribeToCategories } from '@/stores/dataStore';
import { Category } from '@/services/categoryService';
import { useAuth } from '@/contexts/AuthContext';
import DiscountModal from './components/DiscountModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import EmptyDiscounts from './illustrations/EmptyDiscounts';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';
import PlusIcon from '@/components/icons/PlusIcon';
import { Timestamp } from 'firebase/firestore';
import { formatCurrency } from '@/lib/currency_formatter';
import DiscountsIcon from '@/components/icons/SidebarNav/DiscountsIcon';

export default function DiscountsScreen() {
  const { user, isAuthenticated } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    discount: Discount | null;
  }>({ isOpen: false, discount: null });

  // Debug authentication
  useEffect(() => {
    console.log('Discounts Page - User:', user);
    console.log('Discounts Page - Is Authenticated:', isAuthenticated);
    console.log('Discounts Page - User UID:', user?.uid);
  }, [user, isAuthenticated]);

  // Subscribe to data changes
  useEffect(() => {
    const unsubscribeDiscounts = subscribeToDiscounts((discounts) => {
      setDiscounts(discounts);
      setLoading(false);
    });

    const unsubscribeCategories = subscribeToCategories((categories) => {
      setCategories(categories);
    });

    return () => {
      unsubscribeDiscounts();
      unsubscribeCategories();
    };
  }, []);

  const handleCreateDiscount = () => {
    setEditingDiscount(null);
    setIsModalOpen(true);
  };

  const handleEditDiscount = (discount: Discount) => {
    setEditingDiscount(discount);
    setIsModalOpen(true);
  };

  const handleDeleteDiscount = (discount: Discount) => {
    setDeleteConfirmation({ isOpen: true, discount });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.discount) return;
    
    try {
      await deleteDiscount(deleteConfirmation.discount.discount_code);
      setDeleteConfirmation({ isOpen: false, discount: null });
    } catch (error) {
      console.error('Error deleting discount:', error);
      alert('Failed to delete discount. Please try again.');
    }
  };

  const formatValue = (discount: Discount) => {
    return discount.type === 'percentage' 
      ? `${discount.value}% OFF` 
      : `-${formatCurrency(discount.value)}`;
  };

  const getAppliesTo = (discount: Discount) => {
    if (!discount.applies_to) return 'All Items';
    
    const category = categories.find(cat => cat.id === discount.applies_to);
    return category ? category.name : 'Unknown Category';
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate();
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return `Invalid Date: ${error}`;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <TopBar title="Discounts" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopBar title="Discounts" icon={<DiscountsIcon />} />

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-3">
            {discounts.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-[200px] mb-4 mx-auto opacity-50 flex items-center justify-center">
                  <EmptyDiscounts />
                </div>
                <h3 className="text-[18px] font-semibold text-[var(--secondary)] mb-3">
                  No Discounts Available
                </h3>
                <p className="w-[300px] text-[12px] text-[var(--secondary)] opacity-70 mb-6 max-w-md mx-auto">
                  Start by adding your first discount code.
                </p>
                <button
                  onClick={handleCreateDiscount}
                  className="text-[14px] inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-[8px] hover:bg-[var(--accent)]/90 transition-all font-black text-shadow-lg hover:scale-105 active:scale-95"
                >
                  <PlusIcon className='size-5 drop-shadow-xl' />
                  <span className="mt-[2px]">ADD YOUR FIRST DISCOUNT CODE</span>
                </button>

                {/* Quick Setup Guide */}
                <div className="mt-[80px] max-w-2xl mx-auto">
                  <div className="bg-[var(--secondary)]/5 border border-[var(--secondary)]/10 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-[var(--secondary)]/50 mb-4 flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-[var(--secondary)]/50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Quick Setup Guide
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-[var(--secondary)]/10 rounded-lg mx-auto mb-3 flex items-center justify-center">
                          <span className="text-[var(--secondary)] font-bold">
                            1
                          </span>
                        </div>
                        <h5 className="text-[14px] font-medium text-[var(--secondary)]/80 mb-1">
                          Create a Discount Code
                        </h5>
                        <p className="text-[12px] text-[var(--secondary)] opacity-80">
                          Choose a unique code 
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="w-10 h-10 bg-[var(--secondary)]/10 rounded-lg mx-auto mb-3 flex items-center justify-center">
                          <span className="text-[var(--secondary)] font-bold">
                            2
                          </span>
                        </div>
                        <h5 className="text-[14px] font-medium text-[var(--secondary)]/80 mb-1">
                          Set Discount Value
                        </h5>
                        <p className="text-[12px] text-[var(--secondary)]] opacity-80">
                          Set a percentage or fixed amount for the discount
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="w-10 h-10 bg-[var(--secondary)]/10 rounded-lg mx-auto mb-3 flex items-center justify-center">
                          <span className="text-[var(--secondary)] font-bold">
                            3
                          </span>
                        </div>
                        <h5 className="text-[14px] font-medium text-[var(--secondary)]/80 mb-1">
                          Assign to a Category
                        </h5>
                        <p className="text-[12px] text-[var(--secondary)]] opacity-80">
                          Choose from existing categories to assign the discount
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-8xl mx-auto">
                {/* Header with Create Button */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--secondary)]">
                    Discount Codes
                  </h2>
                  <button
                    onClick={handleCreateDiscount}
                    className="bg-[var(--accent)] text-[var(--secondary)] text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-semibold shadow-sm hover:scale-105 active:scale-95"
                  >
                    <div className="flex flex-row items-center gap-2 text-[var(--primary)] text-shadow-lg font-black text-[14px]">
                      <div className="w-4 h-4">
                        <PlusIcon className="drop-shadow-lg"/>
                      </div>
                      <span className="mt-[2px]">
                        ADD DISCOUNT
                      </span> 
                    </div>
                  </button>
                </div>

                {/* Discounts Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Discount Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Applies To
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Modified
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {discounts.map((discount) => (
                          <tr key={discount.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="text-sm font-medium text-[var(--secondary)]">
                                  {discount.discount_code}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary)]">
                              <span className="ml-2 text-sm font-semibold text-[var(--secondary)]">
                                {formatValue(discount)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-medium ${
                                  discount.type === 'percentage'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {discount.type === 'percentage' ? 'Percentage' : 'Flat Amount'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary)]">
                              {getAppliesTo(discount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary)]">
                              {formatDate(discount.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary)]">
                              {formatDate(discount.modified_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditDiscount(discount)}
                                  className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                  title="Edit discount"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  onClick={() => handleDeleteDiscount(discount)}
                                  className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                  title="Delete discount"
                                >
                                  <DeleteIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-6 text-sm text-gray-500">
                  Showing {discounts.length} discount{discounts.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <DiscountModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          discount={editingDiscount}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingDiscount(null);
          }}
        />

        <DeleteConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() => setDeleteConfirmation({ isOpen: false, discount: null })}
          onConfirm={confirmDelete}
          title="Delete Discount"
          message={`Are you sure you want to delete the discount code "${deleteConfirmation.discount?.discount_code}"? This action cannot be undone.`}
        />
      </div>
    </div>
  );
}