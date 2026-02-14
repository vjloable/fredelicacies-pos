// Auth Service - Refactored for Supabase
// Business logic for authentication and user management
import { authRepository, userProfileRepository } from '@/lib/repositories';
import type { SignUpData, SignInData, UserWithRoles, CreateUserProfileData, UpdateUserProfileData, RoleAssignment } from '@/types/domain';

export const authService = {
  // Sign up new user with profile
  signUp: async (data: SignUpData & { name: string; isOwner?: boolean }): Promise<{ userId: string | null; error: any }> => {
    // Create auth user
    const { user, error: signUpError } = await authRepository.signUp(data);
    
    if (signUpError || !user) {
      return { userId: null, error: signUpError };
    }

    // Create user profile
    const profileData: CreateUserProfileData = {
      id: user.id,
      email: user.email,
      name: data.name,
      is_owner: data.isOwner || false,
    };

    const { error: profileError } = await userProfileRepository.create(profileData);

    if (profileError) {
      // Profile creation failed, but auth user exists - log error
      console.error('Failed to create user profile:', profileError);
      return { userId: user.id, error: profileError };
    }

    return { userId: user.id, error: null };
  },

  // Sign in
  signIn: async (email: string, password: string): Promise<{ session: any; error: any }> => {
    return await authRepository.signIn({ email, password });
  },

  // Sign out
  signOut: async (): Promise<{ error: any }> => {
    return await authRepository.signOut();
  },

  // Get current authenticated user
  getCurrentUser: async (): Promise<{ user: any; error: any }> => {
    return await authRepository.getCurrentUser();
  },

  // Get current session
  getSession: async (): Promise<{ session: any; error: any }> => {
    return await authRepository.getSession();
  },

  // Get user data with role assignments
  getUserData: async (userId: string): Promise<UserWithRoles | null> => {
    const { user, error } = await userProfileRepository.getWithRoles(userId);
    
    if (error) {
      console.error('Error fetching user data:', error);
      return null;
    }

    return user;
  },

  // Create user profile (called after auth user is created)
  createUserProfile: async (
    userId: string,
    userData: {
      name: string;
      email: string;
      isOwner?: boolean;
      roleAssignments?: RoleAssignment[];
      phoneNumber?: string;
      employeeId?: string;
    }
  ): Promise<{ error: any }> => {
    const profileData: CreateUserProfileData = {
      id: userId,
      email: userData.email,
      name: userData.name,
      phone_number: userData.phoneNumber,
      employee_id: userData.employeeId,
      is_owner: userData.isOwner || false,
    };

    const { error } = await userProfileRepository.create(profileData);
    return { error };
  },

  // Update user profile
  updateUserProfile: async (
    userId: string,
    updates: UpdateUserProfileData
  ): Promise<{ error: any }> => {
    const { error } = await userProfileRepository.update(userId, updates);
    return { error };
  },

  // Update user roles (no longer stored in profile - handled by workers table)
  // This method is kept for backward compatibility but delegates to workerService
  updateUserRoles: async (
    userId: string,
    roleAssignments: RoleAssignment[]
  ): Promise<void> => {
    // Role assignments are now managed through the workers table
    // This is handled by workerService.assignWorkerToBranch and removeWorkerFromBranch
    console.warn('updateUserRoles is deprecated - use workerService to manage role assignments');
  },

  // Assign user to branch (backward compatibility)
  assignUserToBranch: async (
    userId: string,
    branchId: string,
    role: 'manager' | 'worker'
  ): Promise<void> => {
    // Delegate to workerService (will be implemented there)
    console.warn('assignUserToBranch should be called from workerService');
  },

  // Remove user from branch (backward compatibility)
  removeUserFromBranch: async (
    userId: string,
    branchId: string
  ): Promise<void> => {
    // Delegate to workerService (will be implemented there)
    console.warn('removeUserFromBranch should be called from workerService');
  },

  // Owner operations
  promoteToOwner: async (userId: string): Promise<void> => {
    const { error } = await userProfileRepository.update(userId, { is_owner: true });
    if (error) {
      console.error('Error promoting user to owner:', error);
      throw error;
    }
  },

  demoteFromOwner: async (userId: string): Promise<void> => {
    const { error } = await userProfileRepository.update(userId, { is_owner: false });
    if (error) {
      console.error('Error demoting user from owner:', error);
      throw error;
    }
  },

  // Subscribe to auth state changes
  onAuthStateChange: (callback: (session: any) => void) => {
    return authRepository.onAuthStateChange(callback);
  },
};

// Type exports for backward compatibility
export interface User extends UserWithRoles {}

export type { RoleAssignment };
