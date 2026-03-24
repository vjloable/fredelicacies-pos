'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from "@/components/LoadingSpinner";
import ImageUpload from '@/components/ImageUpload';
import { updateInventoryItem, deleteInventoryItem } from '@/services/inventoryService';
import { unlockItem } from '@/services/eodService';
import type { InventoryItem, Category, UpdateInventoryItemData } from '@/types/domain';
import type { EodItemLock } from '@/types/domain/eod';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/services/activityLogService';

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
  eodLock?: EodItemLock | null;
  onUnlocked?: () => void;
}

export default function EditItemModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onError,
  eodLock,
  onUnlocked,
}: EditItemModalProps) {
  const { currentBranch } = useBranch();
  const { user, isManager, isUserOwner } = useAuth();
  const canRemove = isManager() || isUserOwner();
  const [loading, setLoading] = useState(false);
  const [localEditingItem, setLocalEditingItem] = useState<Item | null>(editingItem);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [grabPriceInput, setGrabPriceInput] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside for category dropdown
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

  // Update local state when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setLocalEditingItem({ ...editingItem });
      setPriceInput(editingItem.price > 0 ? editingItem.price.toString() : '');
      setCostInput(editingItem.cost ? editingItem.cost.toString() : '');
      setGrabPriceInput(editingItem.grab_price ? editingItem.grab_price.toString() : '');
      setSelectedCategoryIds(
        editingItem.category_ids?.length
          ? editingItem.category_ids
          : editingItem.category_id ? [editingItem.category_id] : []
      );
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

    // Validate grab price (optional field)
    let finalGrabPrice: number | null = null;
    if (grabPriceInput !== '') {
      finalGrabPrice = parseFloat(grabPriceInput);
      if (isNaN(finalGrabPrice) || finalGrabPrice < 0) {
        onError('Please enter a valid grab price');
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
      const updates: UpdateInventoryItemData = {
        name: localEditingItem.name,
        price: finalPrice,
        cost: finalCost,
        grab_price: finalGrabPrice,
        stock: localEditingItem.stock,
        description: localEditingItem.description || undefined,
        category_ids: selectedCategoryIds,
        category_id: selectedCategoryIds[0] || undefined,
        img_url: localEditingItem.img_url || undefined
      };
      
      await updateInventoryItem(localEditingItem.id, updates);

      if (editingItem && currentBranch) {
        const branchId = currentBranch.id;
        const userId = user?.id ?? null;
        const newName = updates.name ?? editingItem.name;
        if (updates.name !== undefined && updates.name !== editingItem.name)
          void logActivity({ branchId, userId, action: 'item_renamed', entityType: 'inventory', entityId: localEditingItem.id, details: { old_name: editingItem.name, new_name: updates.name } });
        if (updates.price !== undefined && updates.price !== editingItem.price)
          void logActivity({ branchId, userId, action: 'item_price_changed', entityType: 'inventory', entityId: localEditingItem.id, details: { item_name: newName, old_price: editingItem.price, new_price: updates.price } });
        if (updates.img_url !== undefined && (updates.img_url || null) !== editingItem.img_url)
          void logActivity({ branchId, userId, action: 'item_photo_changed', entityType: 'inventory', entityId: localEditingItem.id, details: { item_name: newName } });
        const prevCategoryIds = editingItem.category_ids?.length
          ? editingItem.category_ids
          : editingItem.category_id ? [editingItem.category_id] : [];
        const categoriesChanged =
          selectedCategoryIds.length !== prevCategoryIds.length ||
          selectedCategoryIds.some(id => !prevCategoryIds.includes(id));
        if (categoriesChanged)
          void logActivity({ branchId, userId, action: 'item_category_changed', entityType: 'inventory', entityId: localEditingItem.id, details: { item_name: newName, old_categories: prevCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean), new_categories: selectedCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean) } });
        if (updates.stock !== undefined && updates.stock !== editingItem.stock) {
          const delta = updates.stock - editingItem.stock;
          void logActivity({ branchId, userId, action: delta > 0 ? 'stock_added' : 'stock_removed', entityType: 'inventory', entityId: localEditingItem.id, details: { item_name: newName, old_stock: editingItem.stock, new_stock: updates.stock, delta: Math.abs(delta) } });
        }
      }

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
      if (currentBranch)
        void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'item_deleted', entityType: 'inventory', entityId: itemId, details: { name: localEditingItem?.name } });
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
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50"
      onClick={!loading ? closeModal : undefined}
    >
      <div 
        className="bg-white rounded-xl p-5 max-w-2xl w-full mx-4 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Screen */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <LoadingSpinner size="lg" />
            <div className="text-center">
              <p className="text-sm font-semibold text-secondary">{showDeleteConfirm ? 'Removing Item...' : 'Updating Item...'}</p>
              <p className="text-xs text-secondary/50">Please wait</p>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 bg-accent/20 rounded-xl mx-auto mb-3 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-secondary mb-1">
                Edit Item
              </h3>
              <p className="text-xs text-secondary opacity-70">
                Update item information and manage stock
              </p>
            </div>

        {/* Item Image Upload */}
          {/* Image Upload */}
          <ImageUpload
            currentImageUrl={localEditingItem.img_url || ''}
            onImageUpload={(imageUrl) => setLocalEditingItem({...localEditingItem, img_url: imageUrl})}
            onImageRemove={() => setLocalEditingItem({...localEditingItem, img_url: ''})}
            bucket="inventory-images"
            compact
          />
        
        {/* Edit Form */}
        <div className="space-y-4">
          {/* Item Name */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-2">
              Item Name <span className='text-error'>*</span>
            </label>
            <input
              type="text"
              value={localEditingItem.name}
              onChange={(e) => setLocalEditingItem({...localEditingItem, name: e.target.value})}
              className="w-full px-3 py-2 h-9.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Enter item name"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-2">
              Categories
              <span className="text-xs text-secondary/50 ml-1">(Optional)</span>
            </label>
            <div className="relative" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen(o => !o)}
                className="w-full min-h-9.5 px-3 py-1.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent flex items-center flex-wrap gap-1.5 text-left bg-white"
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
                <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-white border-2 border-secondary/20 rounded-lg shadow-lg max-h-36 overflow-y-auto">
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

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-2">
              Description
            </label>
            <textarea
              value={localEditingItem.description || ''}
              onChange={(e) => setLocalEditingItem({...localEditingItem, description: e.target.value})}
              className="w-full px-3 py-1.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              placeholder="Enter item description"
              rows={3}
            />
          </div>

          {/* Price, Cost, and Stock Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">
                Selling Price <span className='text-error'>*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary font-thin">₱</span>
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
                    className="w-full pl-8 pr-4 py-2 h-9.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder="0.00"
                    inputMode="decimal"
                  />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">
                Cost Price <span className="text-xs text-gray-400 ml-1">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary font-thin">₱</span>
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
                    // If empty or invalid, set to null
                    if (costInput === '' || isNaN(parseFloat(costInput))) {
                      setLocalEditingItem({...localEditingItem, cost: null});
                      setCostInput('');
                    }
                  }}
                  className="w-full pl-8 pr-4 py-2 h-9.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          {/* Grab Price */}
          <div>
            <label className="block text-xs font-medium text-secondary mb-2">
              Grab Price <span className="text-xs text-gray-400 ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary font-thin">₱</span>
              <input
                type="number"
                value={grabPriceInput}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                    setGrabPriceInput(value);
                    if (value !== '' && !isNaN(parseFloat(value))) {
                      setLocalEditingItem({...localEditingItem, grab_price: parseFloat(value)});
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  if (grabPriceInput === '' || isNaN(parseFloat(grabPriceInput))) {
                    setLocalEditingItem({...localEditingItem, grab_price: null});
                    setGrabPriceInput('');
                  }
                }}
                className="w-full pl-8 pr-4 py-2 h-9.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Stock Adjustment Section */}
          <div className="bg-primary rounded-xl p-4 border-2 border-secondary/20">
            <h4 className="text-xs font-semibold text-secondary mb-2 flex items-center gap-2">
              Add Stock
            </h4>

            {/* Quick Stock Buttons + Current Stock */}
            <div className="flex gap-3 mb-3">
              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-gray-200 px-4 py-3 min-w-24 shrink-0">
                <div className="text-2xl font-bold text-secondary leading-none">{localEditingItem.stock}</div>
                <div className="text-xs text-secondary/50 mt-1">in stock</div>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  {[1, 5, 10].map(amount => (
                    <button
                      key={`add-${amount}`}
                      onClick={() => setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount})}
                      className="flex-1 py-2 bg-success/10 border-2 border-success hover:bg-success/20 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-lg"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
                {canRemove && (
                  <div className="flex gap-2">
                    {[1, 5, 10].map(amount => (
                      <button
                        key={`sub-${amount}`}
                        onClick={() => setLocalEditingItem({...localEditingItem, stock: Math.max(0, localEditingItem.stock - amount)})}
                        className="flex-1 py-2 bg-error/10 border-2 border-error/40 hover:bg-error/20 text-error rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-lg"
                      >
                        -{amount}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Custom amount"
                className="flex-1 px-3 py-2 h-9.5 text-xs border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^[0-9]*$/.test(value)) {
                    e.target.value = value;
                  }
                }}
                onKeyDown={(e) => {
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
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                    e.target.value = '';
                  }
                }}
                inputMode="numeric"
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  const amount = parseInt(input?.value || '0') || 0;
                  if (amount > 0) {
                    setLocalEditingItem({...localEditingItem, stock: localEditingItem.stock + amount});
                    if (input) input.value = '';
                  }
                }}
                className="px-4 h-9.5 bg-success/10 border-2 border-success hover:bg-success/20 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-xs shrink-0"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-secondary/40 mt-2">To remove stock, use the Destock feature from the inventory list.</p>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-5">
          {canRemove && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 py-2 bg-error/10 hover:bg-error/40 text-error rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              Remove
            </button>
          )}
          <button
            onClick={closeModal}
            className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
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
            className={`flex-1 py-2 rounded-lg font-semibold transition-all active:scale-95 ${
              localEditingItem.name.trim() &&
              priceInput !== '' &&
              !isNaN(parseFloat(priceInput)) &&
              parseFloat(priceInput) > 0 &&
              (costInput === '' || (!isNaN(parseFloat(costInput)) && parseFloat(costInput) >= 0))
                ? 'bg-accent hover:bg-accent text-primary text-shadow-lg hover:scale-105 cursor-pointer'
                : 'bg-gray-100 text-secondary/50 hover:scale-100 cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>

        {/* EOD Lock Status */}
        {eodLock && (
          <div className="mt-4 bg-secondary/5 border border-secondary/15 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-secondary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs font-semibold text-secondary">Locked for EOD</span>
              </div>
              {onUnlocked && (
                <button
                  onClick={async () => {
                    const { error } = await unlockItem(currentBranch?.id ?? '', user?.id ?? null, eodLock);
                    if (!error) onUnlocked();
                  }}
                  className="text-xs text-error hover:underline"
                >
                  Unlock
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-secondary/50">Expected</div>
                <div className="font-bold text-secondary">{eodLock.expected_stock}</div>
              </div>
              <div className="text-center">
                <div className="text-secondary/50">Locked</div>
                <div className="font-bold text-secondary">{eodLock.locked_stock}</div>
              </div>
              <div className="text-center">
                <div className="text-secondary/50">Discrepancy</div>
                <div className={`font-bold ${eodLock.discrepancy === 0 ? 'text-success' : 'text-error'}`}>
                  {eodLock.discrepancy > 0 ? '+' : ''}{eodLock.discrepancy}
                </div>
              </div>
            </div>
            {eodLock.resolution && (
              <div className="mt-2 pt-2 border-t border-secondary/10">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  eodLock.resolution === 'force_wastage' ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'
                }`}>
                  {eodLock.resolution === 'force_wastage' ? 'Sent to Wastage' : 'Force Carry-Over'}
                </span>
                {eodLock.resolution_reason && (
                  <p className="text-xs text-secondary/50 mt-1 italic">"{eodLock.resolution_reason}"</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {canRemove && showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-error/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-secondary mb-2">
                  Remove Item
                </h3>
                <p className="text-secondary opacity-70 mb-6">
                  Are you sure you want to remove <strong>{localEditingItem.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-3 text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 hover:shadow-md transition-colors font-black"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => handleDeleteItem(localEditingItem.id)}
                    className="flex-1 py-3 bg-error hover:bg-error/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
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
