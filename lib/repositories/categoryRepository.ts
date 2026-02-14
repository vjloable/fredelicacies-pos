// Category Repository - Handles category data access
import { supabase } from '@/lib/supabase';
import type { Category, CreateCategoryData, UpdateCategoryData } from '@/types/domain/category';

export const categoryRepository = {
  // Create a new category
  async create(branchId: string, data: CreateCategoryData): Promise<{ category: Category | null; error: any }> {
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        branch_id: branchId,
        name: data.name,
        color: data.color,
      })
      .select()
      .single();

    return { category, error };
  },

  // Get all categories for a branch
  async getByBranch(branchId: string): Promise<{ categories: Category[]; error: any }> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    return { categories: data || [], error };
  },

  // Get single category by ID
  async getById(id: string): Promise<{ category: Category | null; error: any }> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    return { category: data, error };
  },

  // Update category
  async update(id: string, data: UpdateCategoryData): Promise<{ category: Category | null; error: any }> {
    const { data: category, error } = await supabase
      .from('categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    return { category, error };
  },

  // Delete category
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Subscribe to categories changes for a branch
  subscribe(branchId: string, callback: (categories: Category[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ categories }) => callback(categories));

    const channel = supabase
      .channel(`categories-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          // Refetch categories when any change occurs
          this.getByBranch(branchId).then(({ categories }) => callback(categories));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
