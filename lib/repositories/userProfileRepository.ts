// User Profile Repository - Handles global user profile data access
import { supabase } from '@/lib/supabase';
import type { UserProfile, CreateUserProfileData, UpdateUserProfileData, UserWithRoles, RoleAssignment } from '@/types/domain/userProfile';

export const userProfileRepository = {
  // Create a new user profile
  async create(data: CreateUserProfileData): Promise<{ profile: UserProfile | null; error: any }> {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .insert({
        id: data.id,
        email: data.email,
        name: data.name,
        phone_number: data.phone_number || null,
        employee_id: data.employee_id || null,
        profile_picture: data.profile_picture || null,
        is_owner: data.is_owner || false,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    return { profile, error };
  },

  // Get profile by ID
  async getById(userId: string): Promise<{ profile: UserProfile | null; error: any }> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return { profile: data, error };
  },

  // Get profile by email
  async getByEmail(email: string): Promise<{ profile: UserProfile | null; error: any }> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    return { profile: data, error };
  },

  // Get all profiles (owner only)
  async getAll(): Promise<{ profiles: UserProfile[]; error: any }> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('name', { ascending: true });

    return { profiles: data || [], error };
  },

  // Get active profiles only
  async getActive(): Promise<{ profiles: UserProfile[]; error: any }> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    return { profiles: data || [], error };
  },

  // Update profile
  async update(userId: string, data: UpdateUserProfileData): Promise<{ profile: UserProfile | null; error: any }> {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    return { profile, error };
  },

  // Delete profile
  async delete(userId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    return { error };
  },

  // Get user profile with role assignments (aggregated from workers table)
  async getWithRoles(userId: string): Promise<{ user: UserWithRoles | null; error: any }> {
    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { user: null, error: profileError };
    }

    // Get role assignments from workers table
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('branch_id, role, status, created_at, updated_at')
      .eq('user_id', userId);

    if (workersError) {
      return { user: null, error: workersError };
    }

    // Map workers to role assignments
    const roleAssignments: RoleAssignment[] = (workers || [])
      .filter(w => w.role !== 'owner') // Owners are global, not branch-specific
      .map(w => ({
        branchId: w.branch_id,
        role: w.role as 'manager' | 'worker',
        assignedAt: w.created_at,
        isActive: w.status === 'active',
      }));

    const userWithRoles: UserWithRoles = {
      ...profile,
      roleAssignments,
    };

    return { user: userWithRoles, error: null };
  },

  // Subscribe to profile changes
  subscribe(userId: string, callback: (profile: UserProfile | null) => void) {
    // Initial fetch
    this.getById(userId).then(({ profile }) => callback(profile));

    const channel = supabase
      .channel(`user-profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          this.getById(userId).then(({ profile }) => callback(profile));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },

  // Subscribe to all profiles (owner only)
  subscribeAll(callback: (profiles: UserProfile[]) => void) {
    // Initial fetch
    this.getAll().then(({ profiles }) => callback(profiles));

    const channel = supabase
      .channel('user-profiles-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
        },
        () => {
          this.getAll().then(({ profiles }) => callback(profiles));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
