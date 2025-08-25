'use client';

import { useState, useEffect } from 'react';
import ImageUpload from '@/components/ImageUpload';
import { InventoryItem, updateInventoryItem, deleteInventoryItem } from '@/services/inventoryService';
import { Category } from '@/services/categoryService';
import DropdownField from '@/components/DropdownField';

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
  const [priceInput, setPriceInput] = useState('');
  const [costInput, setCostInput] = useState('');

  // Update local state when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setLocalEditingItem({ ...editingItem });
      setPriceInput(editingItem.price > 0 ? editingItem.price.toString() : '');
      setCostInput(editingItem.cost ? editingItem.cost.toString() : '');
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
    if (!localEditingItem || !localEditingItem.name.trim()) {
      onError('Item name is required');
      return;
    }
    
    // Validate price
    const finalPrice = priceInput === '' ? 0 : parseFloat(priceInput);
    if (isNaN(finalPrice) || finalPrice < 0) {
      onError('Please enter a valid selling price');
      return;
    }
    
    // Validate cost (optional field)
    let finalCost: number | undefined = undefined;
    if (costInput !== '') {
      finalCost = parseFloat(costInput);
      if (isNaN(finalCost) || finalCost < 0) {
        onError('Please enter a valid cost price');
        return;
      }
    }
    
    // Ensure price is greater than 0 for selling
    if (finalPrice <= 0) {
      onError('Selling price must be greater than 0');
      return;
    }
    
    setLoading(true);
    try {
      const updates: Partial<InventoryItem> = {
        name: localEditingItem.name,
        price: finalPrice,
        cost: finalCost,
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
            <div className="w-12 h-12 bg-transparent rounded-xl mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-dashed border-[var(--accent)]"></div>
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
              <div className="w-16 h-16 bg-[var(--accent)]/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        
        {/* Edit Form */}
        <div className="space-y-6">
          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Item Name <span className='text-[var(--error)]'>*</span>
            </label>
            <input
              type="text"
              value={localEditingItem.name}
              onChange={(e) => setLocalEditingItem({...localEditingItem, name: e.target.value})}
              className="w-full px-4 py-3 border-2 border-[var(--secondary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter item name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Category <span className='text-[var(--error)]'>*</span>
            </label>
            <DropdownField
              options={categories.map((category) => category.name)}
              defaultValue={categories.find(cat => cat.id === localEditingItem.categoryId)?.name || ''}
              onChange={(categoryName) => {
                const selectedCategory = categories.find(cat => cat.name === categoryName);
                if (selectedCategory) {
                  setLocalEditingItem({...localEditingItem, categoryId: selectedCategory.id});
                }
              }}
              roundness={"[12px]"}
              height={52}
              valueAlignment={'left'}
              shadow={false}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Description
            </label>
            <textarea
              value={localEditingItem.description}
              onChange={(e) => setLocalEditingItem({...localEditingItem, description: e.target.value})}
              className="w-full px-4 py-3 border-2 border-[var(--secondary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
              placeholder="Enter item description"
              rows={3}
            />
          </div>

          {/* Price, Cost, and Stock Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Selling Price <span className='text-[var(--error)]'>*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                  <input
                    type="number"
                    value={priceInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      
                      // Only allow digits and one decimal point
                      if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                        setPriceInput(value);
                        
                        // Update the actual price if it's a valid number
                        if (value !== '' && !isNaN(parseFloat(value))) {
                          setLocalEditingItem({...localEditingItem, price: parseFloat(value)});
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
                      if (priceInput === '' || isNaN(parseFloat(priceInput))) {
                        setLocalEditingItem({...localEditingItem, price: 0});
                        setPriceInput('');
                      }
                    }}
                    className="w-full pl-8 pr-4 py-3 border-2 border-[var(--secondary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent "
                    placeholder="0.00"
                    inputMode="decimal"
                  />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                Cost Price <span className="text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--secondary)] font-thin">₱</span>
                <input
                  type="number"
                  value={costInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    
                    // Only allow digits and one decimal point
                    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                      setCostInput(value);
                      
                      // Update the actual cost if it's a valid number
                      if (value !== '' && !isNaN(parseFloat(value))) {
                        setLocalEditingItem({...localEditingItem, cost: parseFloat(value)});
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
                    // If empty or invalid, set to undefined
                    if (costInput === '' || isNaN(parseFloat(costInput))) {
                      setLocalEditingItem({...localEditingItem, cost: undefined});
                      setCostInput('');
                    }
                  }}
                  className="w-full pl-8 pr-4 py-3 border-2 border-[var(--secondary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          {/* Stock Adjustment Section */}
          <div className="bg-[var(--primary)] rounded-xl p-6 border-2 border-[var(--secondary)]/20">
            <h4 className="text-lg font-semibold text-[var(--secondary)] mb-4 flex items-center gap-2">
              Stock Adjustment
            </h4>
            
            {/* Quick Stock Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="space-y-3">
                <label className="block text-center text-sm font-medium text-[var(--secondary)]/50">Remove Stock</label>
                <div className="grid grid-rows-3 grid-cols-1 gap-2">
                  {[1, 5, 10].map(amount => (
                    <button
                      key={`remove-${amount}`}
                      onClick={() => setLocalEditingItem({...localEditingItem, stock: Math.max(0, localEditingItem.stock - amount)})}
                      className="py-2 px-3 bg-[var(--error)]/10 hover:bg-[var(--error)]/20 border-1 border-[var(--error)] text-[var(--secondary)] rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-sm"
                    >
                      -{amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-center font-medium text-[var(--secondary)]/50">Current Stock</label>
                <div className="text-center items-center justify-center flex flex-col bg-gray-50 rounded-xl border-1 border-gray-200 h-[130px]">
                  <div className="text-2xl font-bold text-[var(--secondary)]">{localEditingItem.stock}</div>
                  <div className="text-xs text-[var(--secondary)] opacity-70">units in stock</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm text-center font-medium text-[var(--secondary)]/50">Add Stock</label>
                <div className="grid grid-rows-3 gap-2">
                  {[1, 5, 10].map(amount => (
                    <button
                      key={`add-${amount}`}
                      onClick={() => setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount})}
                      className="py-2 px-3 bg-[var(--success)]/10 border-1 border-[var(--success)] hover:bg-[var(--success)]/20 text-[var(--secondary)] rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-sm"
                    >
                      +{amount}
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
                  type="text"
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border-2 border-[var(--secondary)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow whole numbers (no decimals for stock)
                    if (value === '' || /^[0-9]*$/.test(value)) {
                      e.target.value = value;
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent scientific notation and decimals
                    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                      e.preventDefault();
                    }
                    if (e.key === 'Enter') {
                      const amount = parseInt((e.target as HTMLInputElement).value) || 0;
                      if (amount > 0) {
                        setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount});
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  onBlur={(e) => {
                    // If empty or invalid, clear the field
                    const value = e.target.value;
                    if (value === '' || isNaN(parseInt(value))) {
                      e.target.value = '';
                    }
                  }}
                  inputMode="numeric"
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
                  className="flex-1 py-2 h-[44px] bg-[var(--success)]/10 border-1 border-[var(--success)] hover:bg-[var(--success)]/20 text-[var(--secondary)] rounded-lg font-medium transition-all hover:scale-105 active:scale-95 text-sm"
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
                  className="flex-1 py-2 h-[44px] bg-[var(--error)]/10 border-1 border-[var(--error)] hover:bg-[var(--error)]/20 text-[var(--secondary)] rounded-lg font-medium transition-all hover:scale-105 active:scale-95 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8 grid-cols-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 px-6 py-3 bg-[var(--error)]/10 hover:bg-[var(--error)]/40 text-[var(--error)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            Remove
          </button>
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={saveItemEdit}
            disabled={
              !localEditingItem.name.trim() || 
              priceInput === '' || 
              isNaN(parseFloat(priceInput)) || 
              parseFloat(priceInput) <= 0 ||
              (costInput !== '' && (isNaN(parseFloat(costInput)) || parseFloat(costInput) < 0))
            }
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 ${
              localEditingItem.name.trim() && 
              priceInput !== '' && 
              !isNaN(parseFloat(priceInput)) && 
              parseFloat(priceInput) > 0 &&
              (costInput === '' || (!isNaN(parseFloat(costInput)) && parseFloat(costInput) >= 0))
                ? 'bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--primary)] text-shadow-lg hover:scale-105 cursor-pointer'
                : 'bg-[var(--secondary)]/20 text-[var(--secondary)]/40 hover:scale-100 cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-[var(--error)]/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="flex-1 px-4 py-3 text-sm text-[var(--secondary)]/80 bg-white border border-[var(--secondary)]/20 rounded-lg hover:bg-gray-50 hover:shadow-md transition-colors font-black"
                  >
                      CANCEL
                  </button>
                  <button
                    onClick={() => handleDeleteItem(localEditingItem.id)}
                    className="flex-1 py-3 bg-[var(--error)] hover:bg-[var(--error)]/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
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
