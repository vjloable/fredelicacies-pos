// Migrated categoryService using Supabase
// This is a reference implementation - compare with original categoryService.ts
import { supabase } from '@/lib/supabase';

// Export type matching existing Category interface
export interface Category {
  id: string;
  branch_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Create a new category
export const createCategory = async (
  branchId: string,
  categoryData: { name: string; color: string }
): Promise<string> => {
  try {
    const insertData = {
      branch_id: branchId,
      name: categoryData.name,
      color: categoryData.color,
    };

    const { data, error } = await supabase
      .from('categories')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

// Get all categories for a branch
export const getCategories = async (branchId: string): Promise<Category[]> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error getting categories:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
};

// Subscribe to categories changes for a branch
export const subscribeToCategories = (
  branchId: string,
  callback: (categories: Category[]) => void
): (() => void) => {
  // Initial fetch
  getCategories(branchId).then(callback).catch(console.error);

  // Set up realtime subscription
  const channel = supabase
    .channel(`categories-${branchId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'categories',
        filter: `branch_id=eq.${branchId}`,
      },
      (payload: unknown) => {
        console.log('Category change detected:', payload);
        // Refetch all categories when any change occurs
        getCategories(branchId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    channel.unsubscribe();
  };
};

// Update a category
export const updateCategory = async (
  id: string,
  updates: { name?: string; color?: string }
): Promise<void> => {
  try {
    const updateData = {
      ...updates,
    };

    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

// Delete a category
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Get a single category by ID
export const getCategoryById = async (id: string): Promise<Category | null> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting category by ID:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting category by ID:', error);
    return null;
  }
};

// Helper function to get category by ID from array (for backwards compatibility)
export const getCategoryByIdFromArray = (
  categories: Category[],
  categoryId: string
): Category => {
  return (
    categories.find((cat) => cat.id === categoryId) || {
      id: categoryId,
      branch_id: '',
      name: 'Unknown',
      color: '#000000',
      created_at: '',
      updated_at: '',
    }
  );
};

// Helper function to get category name by ID
export const getCategoryName = (
  categories: Category[],
  categoryId: string
): string => {
  const category = getCategoryByIdFromArray(categories, categoryId);
  return category?.name || 'Unknown';
};

// Helper function to get category color by ID
export const getCategoryColor = (
  categories: Category[],
  categoryId: string
): string => {
  const category = getCategoryByIdFromArray(categories, categoryId);
  return category?.color || '#000000';
};
