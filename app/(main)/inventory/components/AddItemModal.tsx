'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import { InventoryItem, createInventoryItem } from '@/services/inventoryService';
import { Category } from '@/services/categoryService';

interface AddItemModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onError: (error: string) => void;
}

export default function AddItemModal({
  isOpen,
  categories,
  onClose,
  onError
}: AddItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState({ 
    name: "", 
    price: '', 
    categoryId: categories[0]?.id || '', 
    stock: '', 
    description: "",
    imgUrl: ""
  });

  // Update categoryId when categories change and current selection is invalid
  if (categories.length > 0 && !categories.find(cat => cat.id === newItem.categoryId)) {
    setNewItem(prev => ({ ...prev, categoryId: categories[0].id || '' }));
  }

  if (!isOpen) return null;

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    
    setLoading(true);
    try {
      const itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
        name: newItem.name,
        price: parseFloat(newItem.price) || 0,
        categoryId: newItem.categoryId,
        stock: parseInt(newItem.stock) || 0,
        description: newItem.description,
        imgUrl: newItem.imgUrl || ''
      };
      
      await createInventoryItem(itemData);
      
      // Reset form
      setNewItem({ 
        name: "", 
        price: '', 
        categoryId: categories[0]?.id || '', 
        stock: '', 
        description: "",
        imgUrl: ""
      });
      onClose();
    } catch (error) {
      console.error('Error adding item:', error);
      onError('Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
            <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
              Adding Item...
            </h3>
            <p className="text-[var(--secondary)] opacity-70">
              Please wait while we add your new item to the inventory
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                Add New Item
              </h3>
              <p className="text-[var(--secondary)] opacity-70">
                Create a new item for your inventory
              </p>
            </div>

        {/* Add Item Form */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Item Name *
              </label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Enter item name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="0.00"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Initial Stock *
              </label>
              <input
                type="number"
                value={newItem.stock}
                onChange={(e) => setNewItem({...newItem, stock: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Category *
              </label>
              <select
                value={newItem.categoryId}
                onChange={(e) => setNewItem({...newItem, categoryId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Description
              </label>
              <input
                type="text"
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Enter description"
              />
            </div>
          </div>
          
          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Item Image
            </label>
            <ImageUpload
              currentImageUrl={newItem.imgUrl}
              onImageUpload={(imageUrl) => setNewItem({...newItem, imgUrl: imageUrl})}
              onImageRemove={() => setNewItem({...newItem, imgUrl: ""})}
            />
          </div>

          {/* Preview Section */}
          {(newItem.name || newItem.price || newItem.imgUrl) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-[var(--secondary)] opacity-70 mb-2">Preview:</div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {newItem.imgUrl ? (
                    <img
                      src={newItem.imgUrl}
                      alt={newItem.name || 'New item'}
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
                    <h4 className="font-semibold text-[var(--secondary)]">
                      {newItem.name || 'Item Name'}
                    </h4>
                    <div className="font-semibold text-[var(--accent)]">
                      {parseFloat(newItem.price || '0').toFixed(2)} Php
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-[var(--secondary)] opacity-70 flex-1">
                      {newItem.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: categories.find(cat => cat.id === newItem.categoryId)?.color || '#6B7280' }}
                      ></div>
                      <span className="text-sm text-[var(--secondary)] opacity-70">
                        {categories.find(cat => cat.id === newItem.categoryId)?.name || 'Unknown Category'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-[var(--secondary)] opacity-70">Initial Stock</div>
                  <div className="text-xl font-bold text-[var(--secondary)]">
                    {parseInt(newItem.stock || '0')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={addItem}
            disabled={!newItem.name.trim() || !newItem.price || parseFloat(newItem.price) <= 0}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 ${
              newItem.name.trim() && newItem.price && parseFloat(newItem.price) > 0
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Add Item
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
