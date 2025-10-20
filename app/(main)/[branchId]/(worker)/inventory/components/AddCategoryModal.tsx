'use client';

import { useState } from 'react';
import { createCategory } from '@/services/categoryService';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onError: (error: string) => void;
}

export default function AddCategoryModal({
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
        await createCategory({
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
      className="fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-dashed border-2 border-[--accent]"></div>
            </div>
            <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
              Adding Category...
            </h3>
            <p className="text-[var(--secondary)] opacity-70">
              Please wait while we add your new category
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[var(--accent)]/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                Add New Category
              </h3>
              <p className="text-[var(--secondary)] opacity-70">
                Create a new category to organize your items
              </p>
            </div>

        {/* Add Category Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Category Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter category name"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Category Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                className="w-16 h-12 border-2 p-1 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent cursor-pointer "
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent font-mono text-sm"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm text-[var(--secondary)] opacity-70 mb-2">Preview:</div>
            <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-lg border border-gray-200">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: newCategory.color }}
              ></div>
              <span className="font-medium text-[var(--secondary)]">
                {newCategory.name || 'Category Name'}
              </span>
              <span className="text-xs text-[var(--secondary)] opacity-50 bg-gray-100 px-2 py-1 rounded-full ml-auto">
                0 items
              </span>
            </div>
          </div>
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
            onClick={addCategory}
            disabled={!newCategory.name.trim()}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95 ${
              newCategory.name.trim()
                ? 'bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--primary)] text-shadow-lg hover:scale-105 cursor-pointer'
                : 'bg-[var(--secondary)]/20 text-[var(--secondary)]/40 hover:scale-100 cursor-not-allowed'
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
