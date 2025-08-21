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
import PlusIcon from './icons/PlusIcon';

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
      ? `${discount.value}%` 
      : `$${discount.value.toFixed(2)}`;
  };

  const getAppliesTo = (discount: Discount) => {
    if (!discount.applies_to) return 'All Items';
    
    const category = categories.find(cat => cat.id === discount.applies_to);
    return category ? category.name : 'Unknown Category';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return 'Invalid Date';
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
        <TopBar title="Discounts" />
        
        <div className="flex-1 overflow-auto p-6">
          {discounts.length === 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <EmptyDiscounts />
              </div>
              <div className="flex justify-center pb-6">
                <button
                  onClick={handleCreateDiscount}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <PlusIcon />
                  Create First Discount
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              {/* Header with Create Button */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Discount Codes</h1>
                  <p className="text-gray-600 mt-1">
                    Manage your discount codes and special offers
                  </p>
                </div>
                <button
                  onClick={handleCreateDiscount}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <PlusIcon />
                  New Discount
                </button>
              </div>

              {/* Discounts Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Discount Code
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type & Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Applies To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Modified
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {discounts.map((discount) => (
                        <tr key={discount.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">
                                {discount.discount_code}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                discount.type === 'percentage'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {discount.type === 'percentage' ? 'Percentage' : 'Flat Amount'}
                              </span>
                              <span className="ml-2 text-sm font-semibold text-gray-900">
                                {formatValue(discount)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {getAppliesTo(discount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(discount.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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