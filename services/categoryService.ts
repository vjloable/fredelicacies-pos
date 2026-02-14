import { categoryRepository } from '@/lib/repositories';
import type { Category, CreateCategoryData, UpdateCategoryData } from '@/types/domain';

// Re-export types for convenience
export type { Category, CreateCategoryData, UpdateCategoryData };

// Create a new category
export const createCategory = async (branchId: string, categoryData: CreateCategoryData): Promise<{ id: string | null; error: any }> => {
  const { category, error } = await categoryRepository.create(branchId, categoryData);
  return { id: category?.id || null, error };
};

// Get all categories for a branch
export const getCategories = async (branchId: string): Promise<{ categories: Category[]; error: any }> => {
  return await categoryRepository.getByBranch(branchId);
};

// Get category by ID
export const getCategoryById = async (id: string): Promise<{ category: Category | null; error: any }> => {
  return await categoryRepository.getById(id);
};

// Update category
export const updateCategory = async (id: string, data: UpdateCategoryData): Promise<{ category: Category | null; error: any }> => {
  return await categoryRepository.update(id, data);
};

// Delete a category
export const deleteCategory = async (id: string): Promise<{ error: any }> => {
  return await categoryRepository.delete(id);
};

// Subscribe to categories changes for a branch
export const subscribeToCategories = (branchId: string, callback: (categories: Category[]) => void): (() => void) => {
  return categoryRepository.subscribe(branchId, callback);
};

// Helper function to find category by ID in a list
export const findCategoryById = (categories: Category[], categoryId: string): Category | undefined => {
  return categories.find(cat => cat.id === categoryId);
};

// Helper function to get category name by ID
export const getCategoryName = (categories: Category[], categoryId: string): string => {
  const category = findCategoryById(categories, categoryId);
  return category?.name || "Unknown";
};

// Helper function to get category color by ID
export const getCategoryColor = (categories: Category[], categoryId: string): string => {
  const category = findCategoryById(categories, categoryId);
  return category?.color || "#000000";
};
