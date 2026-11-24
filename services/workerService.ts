// Worker Service - Refactored for Supabase
// Business logic for worker management
import { userProfileRepository, workerRepository, authRepository } from '@/lib/repositories';
import type { CreateUserProfileData } from '@/types/domain';
import { supabase } from '@/lib/supabase';

// Worker interface for backward compatibility
export interface Worker {
  id: string;
  name: string;
  email: string;
  roleAssignments: Array<{
    workersTableId: string;
    branchId: string;
    role: 'team_leader' | 'cashier';
    assignedAt: Date;
    assignedBy: string;
    isActive: boolean;
    viaEvent?: boolean;
  }>;
  isOwner: boolean;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
  pinHash?: string;
}

export const workerService = {
  // Create worker (with auth account and profile)
  createWorker: async (userData: {
    name: string;
    email: string;
    password: string;
    isOwner?: boolean;
    isManager?: boolean;
    branchAssignments?: Array<{ branchId: string; role: 'team_leader' | 'cashier' }>;
  }): Promise<string> => {
    try {
      // Create auth user
      const { user, error: authError } = await authRepository.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError || !user) {
        throw new Error(authError?.message || 'Failed to create auth user');
      }

      // Create user profile
      const profileData: CreateUserProfileData = {
        id: user.id,
        email: userData.email,
        name: userData.name,
        is_owner: userData.isOwner || false,
        is_manager: userData.isManager || false,
      };

      const { error: profileError } = await userProfileRepository.create(profileData);

      if (profileError) {
        console.error('Failed to create user profile:', profileError);
        throw new Error('Failed to create user profile');
      }

      // Create branch assignments in workers table
      if (userData.branchAssignments && userData.branchAssignments.length > 0) {
        for (const assignment of userData.branchAssignments) {
          await workerRepository.create(assignment.branchId, {
            user_id: user.id,
            role: assignment.role,
          });
        }
      }

      console.log('✅ Worker created successfully:', user.id);
      return user.id;
    } catch (error) {
      console.error('❌ Error creating worker:', error);
      throw error;
    }
  },

  // Get worker by user ID. includeEventBranches adds the signed-in user's
  // open access to event branches (see userProfileRepository.withEventBranchAccess).
  getWorker: async (userId: string, includeEventBranches = false): Promise<Worker | null> => {
    try {
      // Get user profile with role assignments
      const { user: baseUser, error } = await userProfileRepository.getWithRoles(userId);

      if (error || !baseUser) {
        console.error('Error fetching worker:', error);
        return null;
      }
      const user = includeEventBranches
        ? await userProfileRepository.withEventBranchAccess(baseUser)
        : baseUser;

      // Convert to Worker format
      const worker: Worker = {
        id: user.id,
        name: user.name,
        email: user.email,
        roleAssignments: user.roleAssignments.map(ra => ({
          workersTableId: ra.workersTableId,
          branchId: ra.branchId,
          role: ra.role,
          assignedAt: new Date(ra.assignedAt),
          assignedBy: '', // Not tracked in new schema
          isActive: ra.isActive,
          viaEvent: ra.viaEvent,
        })),
        isOwner: user.is_owner,
        profilePicture: user.profile_picture,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
        createdBy: user.created_by || '',
        isActive: user.is_active,
      };

      return worker;
    } catch (error) {
      console.error('Error fetching worker:', error);
      return null;
    }
  },

  // Update worker
  updateWorker: async (userId: string, updates: Partial<Worker>): Promise<void> => {
    try {
      // Update user profile
      const profileUpdates: any = {};
      
      if (updates.name !== undefined) profileUpdates.name = updates.name;
      if (updates.profilePicture !== undefined) profileUpdates.profile_picture = updates.profilePicture;
      if (updates.isActive !== undefined) profileUpdates.is_active = updates.isActive;

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await userProfileRepository.update(userId, profileUpdates);
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating worker:', error);
      throw error;
    }
  },

  // Delete worker
  deleteWorker: async (userId: string): Promise<void> => {
    try {
      // Delete user profile (cascade will delete workers and attendance)
      const { error } = await userProfileRepository.delete(userId);
      
      if (error) {
        throw new Error('Failed to delete worker');
      }

      console.log('✅ Worker deleted successfully:', userId);
    } catch (error) {
      console.error('Error deleting worker:', error);
      throw error;
    }
  },

  // List workers with filters
  listWorkers: async (filters?: {
    branchId?: string;
    role?: 'team_leader' | 'cashier';
    searchQuery?: string;
    limit?: number;
  }): Promise<Worker[]> => {
    try {
      // Assemble the whole list from 2 bulk queries instead of a per-worker N+1
      // (profile → workers, sequentially). The index on workers.user_id keeps the
      // IN-lookup cheap.
      const { profiles, error } = await userProfileRepository.getActive();

      if (error) {
        console.error('Error listing workers:', error);
        return [];
      }

      const userIds = profiles.map(p => p.id);

      // 1 query: every worker (branch/role) row for these users.
      const { workers: workerRows } = await workerRepository.getByUserIds(userIds);

      // Group role assignments per user (branch roles only; owners have none).
      const assignmentsByUser = new Map<string, Worker['roleAssignments']>();
      for (const w of workerRows) {
        if (w.role !== 'team_leader' && w.role !== 'cashier') continue;
        const list = assignmentsByUser.get(w.user_id) ?? [];
        list.push({
          workersTableId: w.id,
          branchId: w.branch_id,
          role: w.role,
          assignedAt: new Date(w.created_at),
          assignedBy: '',
          isActive: w.status === 'active',
        });
        assignmentsByUser.set(w.user_id, list);
      }

      const workers: Worker[] = profiles.map(profile => {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          roleAssignments: assignmentsByUser.get(profile.id) ?? [],
          isOwner: profile.is_owner,
          profilePicture: profile.profile_picture,
          createdAt: new Date(profile.created_at),
          updatedAt: new Date(profile.updated_at),
          createdBy: profile.created_by || '',
          isActive: profile.is_active,
        };
      });

      // Apply filters
      let filtered = workers;

      if (filters?.branchId) {
        filtered = filtered.filter(w =>
          w.roleAssignments.some(ra => ra.branchId === filters.branchId && ra.isActive)
        );
      }

      if (filters?.role) {
        filtered = filtered.filter(w =>
          w.roleAssignments.some(ra => ra.role === filters.role && ra.isActive)
        );
      }

      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(w =>
          w.name.toLowerCase().includes(searchTerm) ||
          w.email.toLowerCase().includes(searchTerm)
        );
      }

      if (filters?.limit) {
        filtered = filtered.slice(0, filters.limit);
      }

      return filtered;
    } catch (error) {
      console.error('Error listing workers:', error);
      return [];
    }
  },

  // Get workers by branch
  getWorkersByBranch: async (branchId: string): Promise<Worker[]> => {
    return workerService.listWorkers({ branchId });
  },

  // Assign worker to branch
  assignWorkerToBranch: async (
    userId: string,
    branchId: string,
    role: 'team_leader' | 'cashier'
  ): Promise<void> => {
    try {
      // Check if worker assignment already exists
      const { workers } = await workerRepository.getByBranch(branchId);
      const existing = workers.find(w => w.user_id === userId);

      if (existing) {
        // Update existing assignment
        await workerRepository.update(existing.id, {
          role,
          status: 'active',
        });
      } else {
        // Create new assignment
        await workerRepository.create(branchId, {
          user_id: userId,
          role,
        });
      }
    } catch (error) {
      console.error('Error assigning worker to branch:', error);
      throw error;
    }
  },

  // Remove worker from branch
  removeWorkerFromBranch: async (userId: string, branchId: string): Promise<void> => {
    try {
      // Set worker status to inactive
      const { workers } = await workerRepository.getByBranch(branchId);
      const worker = workers.find(w => w.user_id === userId);

      if (worker) {
        await workerRepository.update(worker.id, {
          status: 'inactive',
        });
      }
    } catch (error) {
      console.error('Error removing worker from branch:', error);
      throw error;
    }
  },

  // Update worker role
  updateWorkerRole: async (
    userId: string,
    branchId: string,
    newRole: 'team_leader' | 'cashier'
  ): Promise<void> => {
    try {
      const { workers } = await workerRepository.getByBranch(branchId);
      const worker = workers.find(w => w.user_id === userId);

      if (worker) {
        await workerRepository.update(worker.id, {
          role: newRole,
        });
      } else {
        throw new Error('Worker assignment not found');
      }
    } catch (error) {
      console.error('Error updating worker role:', error);
      throw error;
    }
  },

  // Promote to owner
  promoteToOwner: async (userId: string): Promise<void> => {
    try {
      const { profile, error } = await userProfileRepository.update(userId, { is_owner: true });
      if (error) throw error;
      if (!profile || !profile.is_owner) {
        throw new Error('Failed to grant admin privileges — the update was not applied. Only owners can change admin status.');
      }
    } catch (error) {
      console.error('Error promoting to owner:', error);
      throw error;
    }
  },

  // Demote from owner
  demoteFromOwner: async (userId: string): Promise<void> => {
    try {
      const { profile, error } = await userProfileRepository.update(userId, { is_owner: false });
      if (error) throw error;
      if (!profile || profile.is_owner) {
        throw new Error('Failed to revoke admin privileges — the update was not applied. Only owners can change admin status.');
      }
    } catch (error) {
      console.error('Error demoting from owner:', error);
      throw error;
    }
  },
};

/**
 * Subscribe to realtime changes for a single worker (by auth userId).
 * Fires `callback` with the initial worker record and again whenever the
 * user's profile or workers row changes. Returns an unsubscribe function.
 */
export function subscribeToWorker(
  userId: string,
  callback: (worker: Worker | null) => void
): () => void {
  let cancelled = false;

  const emit = async () => {
    const worker = await workerService.getWorker(userId);
    if (!cancelled) callback(worker);
  };

  // Initial fetch
  void emit();

  // Realtime updates from user_profiles and workers tables
  const channel = supabase
    .channel(`worker-changes-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` },
      () => { void emit(); }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workers', filter: `user_id=eq.${userId}` },
      () => { void emit(); }
    )
    .subscribe();

  return () => {
    cancelled = true;
    channel.unsubscribe();
  };
}
