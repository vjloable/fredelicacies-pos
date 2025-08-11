'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
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

  const openEditModal = (item: Item) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  };

  const saveItemEdit = () => {
    if (!editingItem || !editingItem.name.trim()) return;
    
    setItems(items.map(item => 
      item.id === editingItem.id 
        ? editingItem
        : item
    ));
    
    setShowEditModal(false);
    setEditingItem(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingItem(null);
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
                      
                      {/* Edit Button */}
                      <div>
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-8 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                          Edit Item
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

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div 
          className="fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50"
          onClick={closeEditModal}
        >
          <div 
            className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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

            {/* Edit Form */}
            <div className="space-y-6">
              {/* Item Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
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
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})}
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
                    <div className="text-2xl font-bold text-[var(--secondary)]">{editingItem.stock}</div>
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
                          onClick={() => setEditingItem({...editingItem, stock: editingItem.stock + amount})}
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
                          onClick={() => setEditingItem({...editingItem, stock: Math.max(0, editingItem.stock - amount)})}
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
                            setEditingItem({...editingItem, stock: editingItem.stock + amount});
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
                          setEditingItem({...editingItem, stock: editingItem.stock + amount});
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
                          setEditingItem({...editingItem, stock: Math.max(0, editingItem.stock - amount)});
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
                    value={editingItem.stock}
                    onChange={(e) => setEditingItem({...editingItem, stock: Math.max(0, parseInt(e.target.value) || 0)})}
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
                  value={editingItem.categoryId}
                  onChange={(e) => setEditingItem({...editingItem, categoryId: parseInt(e.target.value)})}
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
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter item description"
                  rows={3}
                />
              </div>

              {/* Preview Card */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-[var(--secondary)] opacity-70 mb-2">Preview:</div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-1">
                      <h4 className="font-semibold text-[var(--secondary)]">{editingItem.name || 'Item Name'}</h4>
                      <div className="font-semibold text-[var(--accent)]">
                        ${editingItem.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-[var(--secondary)] opacity-70 flex-1">
                        {editingItem.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getCategoryColor(editingItem.categoryId) }}
                        ></div>
                        <span className="text-sm text-[var(--secondary)] opacity-70">
                          {getCategoryName(editingItem.categoryId)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-[var(--secondary)] opacity-70">Stock</div>
                    <div className={`text-xl font-bold ${
                      editingItem.stock !== (items.find(item => item.id === editingItem.id)?.stock || 0)
                        ? editingItem.stock > (items.find(item => item.id === editingItem.id)?.stock || 0)
                          ? 'text-green-600'
                          : 'text-red-600'
                        : 'text-[var(--secondary)]'
                    }`}>
                      {editingItem.stock}
                      {editingItem.stock !== (items.find(item => item.id === editingItem.id)?.stock || 0) && (
                        <span className="text-xs ml-1">
                          ({editingItem.stock > (items.find(item => item.id === editingItem.id)?.stock || 0) ? '+' : ''}
                          {editingItem.stock - (items.find(item => item.id === editingItem.id)?.stock || 0)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Low Stock Warning */}
                {editingItem.stock <= 5 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-yellow-700 font-medium">
                        Low stock warning! Only {editingItem.stock} left.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={closeEditModal}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={saveItemEdit}
                disabled={!editingItem.name.trim() || editingItem.price <= 0}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 ${
                  editingItem.name.trim() && editingItem.price > 0
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
