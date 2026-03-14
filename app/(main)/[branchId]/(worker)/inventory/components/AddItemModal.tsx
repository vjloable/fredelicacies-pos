'use client';

import { useState, useRef, useEffect } from 'react';
import LoadingSpinner from "@/components/LoadingSpinner";
import ImageUpload from '@/components/ImageUpload';
import { createInventoryItem } from '@/services/inventoryService';
import type { Category, CreateInventoryItemData } from '@/types/domain';
import PlusIcon from '@/components/icons/PlusIcon';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/services/activityLogService';

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    price: 0,
    cost: undefined as number | undefined,
    stock: 0,
    description: "",
    img_url: ""
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [priceInput, setPriceInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [grabPriceInput, setGrabPriceInput] = useState('');
  const [stockInput, setStockInput] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

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

    // Validate grab price (optional field)
    let finalGrabPrice: number | null = null;
    if (grabPriceInput !== '') {
      finalGrabPrice = parseFloat(grabPriceInput);
      if (isNaN(finalGrabPrice) || finalGrabPrice < 0) {
        onError('Please enter a valid grab price');
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
        grab_price: finalGrabPrice,
        category_ids: selectedCategoryIds,
        category_id: selectedCategoryIds[0] || undefined,
        stock: finalStock,
        description: newItem.description || undefined,
        img_url: newItem.img_url || undefined
      };
      
      await createInventoryItem(currentBranch!.id, itemData);
      void logActivity({ branchId: currentBranch!.id, userId: user?.id ?? null, action: 'item_created', entityType: 'inventory', details: { name: newItem.name, price: finalPrice, categories: selectedCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean) } });

      // Reset form
      setNewItem({
        name: "",
        price: 0,
        cost: undefined,
        stock: 0,
        description: "",
        img_url: ""
      });
      setSelectedCategoryIds([]);
      setPriceInput('');
      setCostInput('');
      setGrabPriceInput('');
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
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-xl p-5 max-w-2xl w-full mx-4 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <LoadingSpinner size="lg" />
            <div className="text-center">
              <p className="text-sm font-semibold text-secondary">"Adding Item..."</p>
              <p className="text-xs text-secondary/50">Please wait</p>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 bg-light-accent rounded-xl mx-auto mb-3 flex items-center justify-center">
                <PlusIcon className='size-5 text-accent'/>
              </div>
              <h3 className="text-sm font-bold text-secondary mb-1">
                Add New Item
              </h3>
              <p className="text-xs text-secondary opacity-70">
                Create a new item for your inventory
              </p>
            </div>

            {/* Add Item Form */}
            <div className="space-y-4 pb-4">

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Item Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Enter item name"
                  />
                </div>
                <div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-2">
                      Description
                      <span className="text-xs text-secondary/50 ml-1">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newItem.description}
                      onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                      className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Enter description"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Selling Price <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary font-thin">₱</span>
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
                      className="w-full pl-8 pr-3 py-2 text-3 h-9.5 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
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
                      className="w-full pl-8 pr-3 py-2 text-3 h-9.5 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Grab Price <span className="text-xs text-gray-400 ml-1">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary font-thin">₱</span>
                    <input
                      type="text"
                      value={grabPriceInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                          setGrabPriceInput(value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        if (grabPriceInput !== '' && isNaN(parseFloat(grabPriceInput))) {
                          setGrabPriceInput('');
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 text-3 h-9.5 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Initial Stock <span className="text-error">*</span>
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
                    className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
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
              </div>
            </div>

            {/* Image Upload */}
            <ImageUpload
              currentImageUrl={newItem.img_url}
              onImageUpload={(imageUrl) => setNewItem({...newItem, img_url: imageUrl})}
              onImageRemove={() => setNewItem({...newItem, img_url: ""})}
              bucket="inventory-images"
              compact
            />

            {/* Action Buttons */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
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
                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                  newItem.name.trim() &&
                  priceInput !== '' &&
                  !isNaN(parseFloat(priceInput)) &&
                  parseFloat(priceInput) > 0 &&
                  (costInput === '' || (!isNaN(parseFloat(costInput)) && parseFloat(costInput) >= 0))
                    ? 'bg-accent hover:bg-accent text-primary text-shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-gray-100 text-secondary/50 hover:scale-100 active:scale-100 cursor-not-allowed'
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
