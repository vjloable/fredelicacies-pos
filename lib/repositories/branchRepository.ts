// Branch Repository - Handles branch data access
import { supabase } from '@/lib/supabase';
import type { Branch, CreateBranchData, UpdateBranchData } from '@/types/domain/branch';

export const branchRepository = {
  // Create a new branch
  async create(ownerId: string, data: CreateBranchData): Promise<{ branch: Branch | null; error: any }> {
    const { data: branch, error } = await supabase
      .from('branches')
      .insert({
        owner_id: ownerId,
        name: data.name,
        address: data.address || null,
        contact_number: data.contact_number || null,
        logo_url: data.logo_url || null,
      })
      .select()
      .single();

    return { branch, error };
  },

  // Get all branches for owner or that user has access to
  async getAll(): Promise<{ branches: Branch[]; error: any }> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name', { ascending: true });

    return { branches: data || [], error };
  },

  // Get single branch by ID
  async getById(id: string): Promise<{ branch: Branch | null; error: any }> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    return { branch: data, error };
  },

  // Update branch
  async update(id: string, data: UpdateBranchData): Promise<{ branch: Branch | null; error: any }> {
    const { data: branch, error } = await supabase
      .from('branches')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    return { branch, error };
  },

  // Delete branch
  async delete(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Subscribe to branches changes
  subscribe(callback: (branches: Branch[]) => void) {
    // Initial fetch
    this.getAll().then(({ branches }) => callback(branches));

    const channel = supabase
      .channel('branches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branches',
        },
        () => {
          // Refetch all branches when any change occurs
          this.getAll().then(({ branches }) => callback(branches));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
