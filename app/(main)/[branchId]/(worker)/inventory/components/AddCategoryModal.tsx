'use client';

import { useState } from 'react';
import { createCategory } from '@/services/categoryService';

interface AddCategoryModalProps {
  branchId: string;
  isOpen: boolean;
  onClose: () => void;
  onError: (error: string) => void;
}

export default function AddCategoryModal({
  branchId,
  isOpen,
  onClose,
  onError
}: AddCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", color: "#ff9f80" });

  if (!isOpen) return null;

  const addCategory = async () => {
    if (newCategory.name.trim()) {
      setLoading(true);
      try {
        await createCategory(branchId, {
          name: newCategory.name,
          color: newCategory.color
        });
        setNewCategory({ name: "", color: "#ff9f80" });
        onClose();
      } catch (error) {
        console.error('Error adding category:', error);
        onError('Failed to add category. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCategory();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 bg-blue-100 rounded-xl mx-auto mb-3 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-dashed border-2 border-accent"></div>
            </div>
            <h3 className="text-base font-bold text-secondary mb-1">
              Adding Category...
            </h3>
            <p className="text-sm text-secondary opacity-70">
              Please wait
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 bg-accent/20 rounded-xl mx-auto mb-3 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-secondary mb-1">
                Add New Category
              </h3>
              <p className="text-sm text-secondary opacity-70">
                Create a new category to organize your items
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Category Name <span className="text-(--error)">*</span>
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 h-9.5 text-3.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Enter category name"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Category Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                    className="w-12 h-9.5 border-2 p-1 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent cursor-pointer"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                      className="w-full px-3 py-2 h-9.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={addCategory}
                disabled={!newCategory.name.trim()}
                className={`flex-1 py-2 rounded-lg font-semibold transition-all active:scale-95 ${
                  newCategory.name.trim()
                    ? 'bg-accent hover:bg-accent text-primary text-shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-secondary/20 text-secondary/40 hover:scale-100 cursor-not-allowed'
                }`}
              >
                Add Category
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
