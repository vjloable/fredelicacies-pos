'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import { createInventoryItem } from '@/services/inventoryService';
import type { Category, CreateInventoryItemData } from '@/types/domain';
import PlusIcon from '@/components/icons/PlusIcon';
import DropdownField from '@/components/DropdownField';
import { useBranch } from '@/contexts/BranchContext';

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
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState({ 
    name: "", 
    price: 0, 
    cost: undefined as number | undefined, // Add optional cost field
    category_id: categories[0]?.id || '', 
    stock: 0, 
    description: "",
    img_url: ""
  });
  const [priceInput, setPriceInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [stockInput, setStockInput] = useState('');

  // Update category_id when categories change and current selection is invalid
  if (categories.length > 0 && !categories.find(cat => cat.id === newItem.category_id)) {
    setNewItem(prev => ({ ...prev, category_id: categories[0].id || '' }));
  }

  if (!isOpen) return null;

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    
    // Validate price
    const finalPrice = priceInput === '' ? 0 : parseFloat(priceInput);
    if (isNaN(finalPrice) || finalPrice <= 0) {
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
    
    // Validate stock
    const finalStock = stockInput === '' ? 0 : parseInt(stockInput);
    if (isNaN(finalStock) || finalStock < 0) {
      onError('Please enter a valid stock amount');
      return;
    }
    
    setLoading(true);
    try {
      const itemData: CreateInventoryItemData = {
        name: newItem.name,
        price: finalPrice,
        cost: finalCost,
        category_id: newItem.category_id,
        stock: finalStock,
        description: newItem.description || undefined,
        img_url: newItem.img_url || undefined
      };
      
      await createInventoryItem(currentBranch!.id, itemData);
      
      // Reset form
      setNewItem({ 
        name: "", 
        price: 0, 
        cost: undefined, // Reset cost field
        category_id: categories[0]?.id || '', 
        stock: 0, 
        description: "",
        img_url: ""
      });
      setPriceInput('');
      setCostInput('');
      setStockInput('');
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
        className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[var(--light-accent)] rounded-xl mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-dashed border-[var(--accent)]"></div>
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
              <div className="w-16 h-16 bg-[var(--light-accent)] rounded-xl mx-auto mb-4 flex items-center justify-center">
                <PlusIcon className='size-6 text-[var(--accent)]'/>
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Item Name <span className="text-[var(--error)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    className="w-full px-3 py-2 text-[14px] h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="Enter item name"
                  />
                </div>
                <div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                      Description
                      <span className="text-xs text-[var(--secondary)]/50 ml-1">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newItem.description}
                      onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                      className="w-full px-3 py-2 text-[14px] h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="Enter description"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Selling Price <span className="text-[var(--error)]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                    <input
                      type="text"
                      value={priceInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        
                        // Only allow digits and one decimal point
                        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                          setPriceInput(value);
                          
                          // Update the actual price if it's a valid number
                          if (value !== '' && !isNaN(parseFloat(value))) {
                            setNewItem({...newItem, price: parseFloat(value)});
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
                          setNewItem({...newItem, price: 0});
                          setPriceInput('');
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 text-[14px] h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                    <input
                      type="text"
                      value={costInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        
                        // Only allow digits and one decimal point
                        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                          setCostInput(value);
                          
                          // Update the actual cost if it's a valid number
                          if (value !== '' && !isNaN(parseFloat(value))) {
                            setNewItem({...newItem, cost: parseFloat(value)});
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
                          setNewItem({...newItem, cost: undefined});
                          setCostInput('');
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 text-[14px] h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Initial Stock <span className="text-[var(--error)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={stockInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow whole numbers (no decimals for stock)
                      if (value === '' || /^[0-9]*$/.test(value)) {
                        setStockInput(value);
                        
                        // Update the actual stock if it's a valid number
                        if (value !== '' && !isNaN(parseInt(value))) {
                          setNewItem({...newItem, stock: parseInt(value)});
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent scientific notation and decimals
                      if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                    onBlur={() => {
                      // If empty or invalid, set to 0
                      if (stockInput === '' || isNaN(parseInt(stockInput))) {
                        setNewItem({...newItem, stock: 0});
                        setStockInput('');
                      }
                    }}
                    className="w-full px-3 py-2 text-[14px] h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Category <span className="text-[var(--error)]">*</span>
                  </label>
                  <DropdownField
                    options={categories.map(cat => cat.name)}
                    defaultValue={categories.find(cat => cat.id === newItem.category_id)?.name || categories[0]?.name || ''}
                    dropdownPosition="bottom-right"
                    dropdownOffset={{ top: 2, right: 0 }}
                    onChange={(categoryName) => {
                      const selectedCategory = categories.find(cat => cat.name === categoryName);
                      if (selectedCategory) {
                        setNewItem({...newItem, category_id: selectedCategory.id});
                      }
                    }}
                    height={44}
                    roundness={"[8px]"}
                    valueAlignment={'left'}
                    shadow={false}
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div>
                <ImageUpload
                  currentImageUrl={newItem.img_url}
                  onImageUpload={(imageUrl) => setNewItem({...newItem, img_url: imageUrl})}
                  onImageRemove={() => setNewItem({...newItem, img_url: ""})}
                />
              </div>

              {/* Preview Section */}
              {/* {(newItem.name || newItem.price || newItem.imgUrl) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-[var(--secondary)] opacity-70 mb-2">Preview:</div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {newItem.imgUrl ? (
                        <Image
                          src={newItem.imgUrl}
                          alt={newItem.name || 'New item'}
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
                        <h4 className="font-semibold text-[var(--secondary)]">
                          {newItem.name || 'Item Name'}
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-[var(--accent)]">
                            {formatCurrency(newItem.price || 0)}
                          </div>
                          {newItem.cost && newItem.cost > 0 && (
                            <>
                              <span className="text-xs text-gray-400">|</span>
                              <div className="text-sm text-gray-600">
                                Cost: {formatCurrency(newItem.cost)}
                              </div>
                              {(newItem.price || 0) > 0 && (
                                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                  {(((newItem.price - (newItem.cost || 0)) / newItem.price) * 100).toFixed(1)}% margin
                                </div>
                              )}
                            </>
                          )}
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
                        {newItem.stock || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )} */}
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
                disabled={
                  !newItem.name.trim() || 
                  priceInput === '' || 
                  isNaN(parseFloat(priceInput)) || 
                  parseFloat(priceInput) <= 0 ||
                  (costInput !== '' && (isNaN(parseFloat(costInput)) || parseFloat(costInput) < 0))
                }
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  newItem.name.trim() && 
                  priceInput !== '' && 
                  !isNaN(parseFloat(priceInput)) && 
                  parseFloat(priceInput) > 0 &&
                  (costInput === '' || (!isNaN(parseFloat(costInput)) && parseFloat(costInput) >= 0))
                    ? 'bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--primary)] text-shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-[var(--secondary)]/20 text-[var(--secondary)]/40 hover:scale-100 active:scale-100 cursor-not-allowed'
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
