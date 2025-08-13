'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import ImageUpload from '@/components/ImageUpload';
import { InventoryItem, updateInventoryItem, deleteInventoryItem } from '@/services/inventoryService';
import { Category, getCategoryName, getCategoryColor } from '@/services/categoryService';

interface Item extends InventoryItem {
  id: string;
}

interface EditItemModalProps {
  isOpen: boolean;
  editingItem: Item | null;
  categories: Category[];
  items: Item[];
  onClose: () => void;
  onError: (error: string) => void;
}

export default function EditItemModal({
  isOpen,
  editingItem,
  categories,
  items,
  onClose,
  onError
}: EditItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [localEditingItem, setLocalEditingItem] = useState<Item | null>(editingItem);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Update local state when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setLocalEditingItem({ ...editingItem });
      setShowDeleteConfirm(false); // Reset delete confirmation when new item is loaded
    }
  }, [editingItem]);

  // Reset delete confirmation when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen || !localEditingItem) return null;

  const saveItemEdit = async () => {
    if (!localEditingItem || !localEditingItem.name.trim()) return;
    
    setLoading(true);
    try {
      const updates: Partial<InventoryItem> = {
        name: localEditingItem.name,
        price: localEditingItem.price,
        stock: localEditingItem.stock,
        description: localEditingItem.description,
        categoryId: localEditingItem.categoryId,
        imgUrl: localEditingItem.imgUrl
      };
      
      await updateInventoryItem(localEditingItem.id, updates);
      
      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
      onError('Failed to update item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setLoading(true);
    try {
      await deleteInventoryItem(itemId);
      setShowDeleteConfirm(false); // Reset delete confirmation first
      onClose(); // Then close the modal
    } catch (error) {
      console.error('Error deleting item:', error);
      onError('Failed to delete item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50"
      onClick={!loading ? closeModal : undefined}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
              {showDeleteConfirm ? 'Removing Item...' : 'Updating Item...'}
            </h3>
            <p className="text-[var(--secondary)] opacity-70">
              {showDeleteConfirm 
                ? 'Please wait while we remove the item from your inventory'
                : 'Please wait while we save your changes'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                Edit Item
              </h3>
              <p className="text-[var(--secondary)] opacity-70">
                Update item information and manage stock
              </p>
            </div>

        {/* Item Image Upload */}
          {/* Image Upload */}
          <ImageUpload
            currentImageUrl={localEditingItem.imgUrl}
            onImageUpload={(imageUrl) => setLocalEditingItem({...localEditingItem, imgUrl: imageUrl})}
            onImageRemove={() => setLocalEditingItem({...localEditingItem, imgUrl: ""})}
          />

        {/* Preview Card */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="text-sm text-[var(--secondary)] opacity-70 mb-2">Preview:</div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {localEditingItem.imgUrl ? (
                <Image
                  src={localEditingItem.imgUrl}
                  alt={localEditingItem.name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-1">
                <h4 className="font-semibold text-[var(--secondary)]">{localEditingItem.name || 'Item Name'}</h4>
                <div className="font-semibold text-[var(--accent)]">
                  {localEditingItem.price.toFixed(2)} Php
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm text-[var(--secondary)] opacity-70 flex-1">
                  {localEditingItem.description || 'No description'}
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getCategoryColor(categories, localEditingItem.categoryId) }}
                  ></div>
                  <span className="text-sm text-[var(--secondary)] opacity-70">
                    {getCategoryName(categories, localEditingItem.categoryId)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-[var(--secondary)] opacity-70">Stock</div>
              <div className={`text-xl font-bold ${
                localEditingItem.stock !== (items.find(item => item.id === localEditingItem.id)?.stock || 0)
                  ? localEditingItem.stock > (items.find(item => item.id === localEditingItem.id)?.stock || 0)
                    ? 'text-green-600'
                    : 'text-red-600'
                  : 'text-[var(--secondary)]'
              }`}>
                {localEditingItem.stock}
                {localEditingItem.stock !== (items.find(item => item.id === localEditingItem.id)?.stock || 0) && (
                  <span className="text-xs ml-1">
                    ({localEditingItem.stock > (items.find(item => item.id === localEditingItem.id)?.stock || 0) ? '+' : ''}
                    {localEditingItem.stock - (items.find(item => item.id === localEditingItem.id)?.stock || 0)})
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Low Stock Warning */}
          {localEditingItem.stock <= 5 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-yellow-700 font-medium">
                  Low stock warning! Only {localEditingItem.stock} left.
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Edit Form */}
        <div className="space-y-6">
          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Item Name *
            </label>
            <input
              type="text"
              value={localEditingItem.name}
              onChange={(e) => setLocalEditingItem({...localEditingItem, name: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter item name"
            />
          </div>

          {/* Price and Stock Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                <input
                  type="number"
                  step="0.01"
                  value={localEditingItem.price}
                  onChange={(e) => setLocalEditingItem({...localEditingItem, price: parseFloat(e.target.value) || 0})}
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Current Stock
              </label>
              <div className="text-center p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div className="text-2xl font-bold text-[var(--secondary)]">{localEditingItem.stock}</div>
                <div className="text-xs text-[var(--secondary)] opacity-70">units in stock</div>
              </div>
            </div>
          </div>

          {/* Stock Adjustment Section */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h4 className="text-lg font-semibold text-[var(--secondary)] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Stock Adjustment
            </h4>
            
            {/* Quick Stock Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-green-700">Add Stock</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10].map(amount => (
                    <button
                      key={`add-${amount}`}
                      onClick={() => setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount})}
                      className="py-2 px-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-sm"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-red-700">Remove Stock</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10].map(amount => (
                    <button
                      key={`remove-${amount}`}
                      onClick={() => setLocalEditingItem({...localEditingItem, stock: Math.max(0, localEditingItem.stock - amount)})}
                      className="py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-sm"
                    >
                      -{amount}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Amount Input */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Custom Amount
                </label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const amount = parseInt((e.target as HTMLInputElement).value) || 0;
                      if (amount > 0) {
                        setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount});
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.previousElementSibling?.querySelector('input') as HTMLInputElement;
                    const amount = parseInt(input?.value || '0') || 0;
                    if (amount > 0) {
                      setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount});
                      if (input) input.value = '';
                    }
                  }}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95 text-sm"
                >
                  Add
                </button>
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.previousElementSibling?.querySelector('input') as HTMLInputElement;
                    const amount = parseInt(input?.value || '0') || 0;
                    if (amount > 0) {
                      setLocalEditingItem({...localEditingItem, stock: Math.max(0, localEditingItem.stock - amount)});
                      if (input) input.value = '';
                    }
                  }}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Direct Stock Input */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Or set exact stock amount
              </label>
              <input
                type="number"
                value={localEditingItem.stock}
                onChange={(e) => setLocalEditingItem({...localEditingItem, stock: Math.max(0, parseInt(e.target.value) || 0)})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Category *
            </label>
            <select
              value={localEditingItem.categoryId}
              onChange={(e) => setLocalEditingItem({...localEditingItem, categoryId: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Description
            </label>
            <textarea
              value={localEditingItem.description}
              onChange={(e) => setLocalEditingItem({...localEditingItem, description: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Enter item description"
              rows={3}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={closeModal}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
          >
            Remove Item
          </button>
          <button
            onClick={saveItemEdit}
            disabled={!localEditingItem.name.trim() || localEditingItem.price <= 0}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 ${
              localEditingItem.name.trim() && localEditingItem.price > 0
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Save Changes
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                  Remove Item
                </h3>
                <p className="text-[var(--secondary)] opacity-70 mb-6">
                  Are you sure you want to remove <strong>{localEditingItem.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteItem(localEditingItem.id)}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
