'use client';

import { useState } from 'react';
import TopBar from "@/components/TopBar";

interface Category {
  id: number;
  name: string;
  color: string;
}

interface Item {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  stock: number;
  description: string;
}

export default function Inventory() {
  const [categories, setCategories] = useState<Category[]>([
    { id: 1, name: "Beverages", color: "#3B82F6" },
    { id: 2, name: "Main Dishes", color: "#10B981" },
    { id: 3, name: "Desserts", color: "#F59E0B" }
  ]);

  const [items, setItems] = useState<Item[]>([
    { id: 1, name: "Coffee", price: 3.50, categoryId: 1, stock: 50, description: "Hot brewed coffee" },
    { id: 2, name: "Burger", price: 8.99, categoryId: 2, stock: 25, description: "Beef burger with fries" },
    { id: 3, name: "Ice Cream", price: 4.25, categoryId: 3, stock: 30, description: "Vanilla ice cream" }
  ]);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", color: "#3B82F6" });
  const [newItem, setNewItem] = useState({ 
    name: "", 
    price: 0, 
    categoryId: categories[0]?.id || 1, 
    stock: 0, 
    description: "" 
  });

  const addCategory = () => {
    if (newCategory.name.trim()) {
      const category: Category = {
        id: Date.now(),
        name: newCategory.name,
        color: newCategory.color
      };
      setCategories([...categories, category]);
      setNewCategory({ name: "", color: "#3B82F6" });
      setShowCategoryForm(false);
    }
  };

  const addItem = () => {
    if (newItem.name.trim()) {
      const item: Item = {
        id: Date.now(),
        name: newItem.name,
        price: newItem.price,
        categoryId: newItem.categoryId,
        stock: newItem.stock,
        description: newItem.description
      };
      setItems([...items, item]);
      setNewItem({ 
        name: "", 
        price: 0, 
        categoryId: categories[0]?.id || 1, 
        stock: 0, 
        description: "" 
      });
      setShowItemForm(false);
    }
  };

  const getCategoryName = (categoryId: number) => {
    return categories.find(cat => cat.id === categoryId)?.name || "Unknown";
  };

  const getCategoryColor = (categoryId: number) => {
    return categories.find(cat => cat.id === categoryId)?.color || "#6B7280";
  };

  const openStockModal = (item: Item, type: 'add' | 'remove') => {
    setSelectedItem(item);
    setAdjustmentType(type);
    setStockAdjustment(0);
    setShowStockModal(true);
    setShowConfirmation(false);
  };

  const handleStockAdjustment = () => {
    if (!selectedItem || stockAdjustment <= 0) return;
    
    const finalAdjustment = adjustmentType === 'add' ? stockAdjustment : -stockAdjustment;
    const newStock = Math.max(0, selectedItem.stock + finalAdjustment);
    
    setItems(items.map(item => 
      item.id === selectedItem.id 
        ? { ...item, stock: newStock }
        : item
    ));
    
    setShowConfirmation(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setSelectedItem(null);
    setStockAdjustment(0);
    setShowConfirmation(false);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Inventory Management" />

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          
          {/* Categories Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[var(--secondary)]">Categories</h2>
              <button
                onClick={() => setShowCategoryForm(!showCategoryForm)}
                className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-medium hover:scale-105 active:scale-95"
              >
                Add Category
              </button>
            </div>

            {/* Add Category Form */}
            {showCategoryForm && (
              <div className="bg-[var(--primary)] p-3 rounded-lg border border-gray-200 mb-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-[var(--secondary)] mb-1">
                      Category Name
                    </label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="Enter category name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--secondary)] mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                      className="w-10 h-9 border border-gray-300 rounded-lg cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={addCategory}
                    className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-medium hover:scale-105 active:scale-95"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowCategoryForm(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-all font-medium hover:scale-105 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Categories List - Compact Horizontal Layout */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="inline-flex items-center gap-2 bg-[var(--primary)] px-3 py-2 rounded-lg border border-gray-200 hover:shadow-sm transition-all"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="text-sm font-medium text-[var(--secondary)]">{category.name}</span>
                  <span className="text-xs text-[var(--secondary)] opacity-50 bg-gray-100 px-2 py-0.5 rounded-full">
                    {items.filter(item => item.categoryId === category.id).length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--secondary)]">Items</h2>
              <button
                onClick={() => setShowItemForm(!showItemForm)}
                className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-medium hover:scale-105 active:scale-95"
              >
                Add Item
              </button>
            </div>

            {/* Add Item Form */}
            {showItemForm && (
              <div className="bg-[var(--primary)] p-4 rounded-lg border border-gray-200 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                      Item Name
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
                      Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newItem.price}
                      onChange={(e) => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                      Stock
                    </label>
                    <input
                      type="number"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                      Category
                    </label>
                    <select
                      value={newItem.categoryId}
                      onChange={(e) => setNewItem({...newItem, categoryId: parseInt(e.target.value)})}
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
                <div className="flex gap-4">
                  <button
                    onClick={addItem}
                    className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-medium hover:scale-105 active:scale-95"
                  >
                    Add Item
                  </button>
                  <button
                    onClick={() => setShowItemForm(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-all font-medium hover:scale-105 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Items List */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-[var(--primary)] p-4 rounded-lg border border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-1">
                          <h3 className="font-semibold text-[var(--secondary)] text-lg truncate">{item.name}</h3>
                          <div className="font-semibold text-[var(--accent)] text-xl">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm text-[var(--secondary)] opacity-70 truncate flex-1">{item.description}</p>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getCategoryColor(item.categoryId) }}
                            ></div>
                            <span className="text-sm text-[var(--secondary)] opacity-70">
                              {getCategoryName(item.categoryId)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Stock Display and Controls */}
                    <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                      {/* Current Stock Display */}
                      <div className="text-center">
                        <div className="text-sm text-[var(--secondary)] opacity-70 mb-1">Stock</div>
                        <div className="text-2xl font-bold text-[var(--secondary)]">{item.stock}</div>
                      </div>
                      
                      {/* Stock Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => openStockModal(item, 'add')}
                          className="px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                          Add Stock
                        </button>
                        <button
                          onClick={() => openStockModal(item, 'remove')}
                          className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                          Remove Stock
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Low Stock Warning */}
                  {item.stock <= 5 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-yellow-700 font-medium">
                          Low stock warning! Only {item.stock} left.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {!showConfirmation ? (
              <>
                {/* Modal Header */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                    {adjustmentType === 'add' ? 'Add Stock' : 'Remove Stock'}
                  </h3>
                  <p className="text-[var(--secondary)] opacity-70">
                    {selectedItem.name}
                  </p>
                </div>

                {/* Current Stock Info */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="text-center">
                    <div className="text-sm text-[var(--secondary)] opacity-70 mb-1">Current Stock</div>
                    <div className="text-3xl font-bold text-[var(--secondary)]">{selectedItem.stock}</div>
                  </div>
                </div>

                {/* Adjustment Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-3">
                    {adjustmentType === 'add' ? 'Amount to Add' : 'Amount to Remove'}
                  </label>
                  <input
                    type="number"
                    value={stockAdjustment}
                    onChange={(e) => setStockAdjustment(parseInt(e.target.value) || 0)}
                    className="w-full h-14 px-4 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="0"
                    min="1"
                    autoFocus
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[1, 5, 10].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setStockAdjustment(amount)}
                      className="py-3 bg-gray-100 hover:bg-gray-200 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                    >
                      {amount}
                    </button>
                  ))}
                </div>

                {/* Preview */}
                {stockAdjustment > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="text-center">
                      <div className="text-sm text-blue-700 mb-1">New Stock Amount</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {adjustmentType === 'add' 
                          ? selectedItem.stock + stockAdjustment
                          : Math.max(0, selectedItem.stock - stockAdjustment)
                        }
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {adjustmentType === 'add' ? '+' : '-'}{stockAdjustment} from current stock
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={closeStockModal}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStockAdjustment}
                    disabled={stockAdjustment <= 0}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 ${
                      stockAdjustment > 0
                        ? adjustmentType === 'add'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {adjustmentType === 'add' ? 'Add Stock' : 'Remove Stock'}
                  </button>
                </div>
              </>
            ) : (
              /* Confirmation Screen */
              <>
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                    adjustmentType === 'add' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <svg className={`w-8 h-8 ${
                      adjustmentType === 'add' ? 'text-green-600' : 'text-red-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                    Stock Updated Successfully!
                  </h3>
                  <p className="text-[var(--secondary)] opacity-70">
                    {selectedItem.name}
                  </p>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[var(--secondary)] opacity-70">Previous Stock:</span>
                      <span className="font-semibold">
                        {adjustmentType === 'add' 
                          ? selectedItem.stock - stockAdjustment
                          : selectedItem.stock + stockAdjustment
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--secondary)] opacity-70">
                        {adjustmentType === 'add' ? 'Added:' : 'Removed:'}
                      </span>
                      <span className={`font-semibold ${
                        adjustmentType === 'add' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {adjustmentType === 'add' ? '+' : '-'}{stockAdjustment}
                      </span>
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <span className="text-[var(--secondary)] font-medium">Current Stock:</span>
                      <span className="text-xl font-bold text-[var(--secondary)]">
                        {selectedItem.stock}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={closeStockModal}
                  className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
