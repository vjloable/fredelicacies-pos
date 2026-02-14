// Worker Service - Refactored for Supabase
// Business logic for worker management
import { userProfileRepository, workerRepository, authRepository } from '@/lib/repositories';
import { attendanceService } from '@/services/attendanceService';
import type { UserWithRoles, RoleAssignment, CreateUserProfileData } from '@/types/domain';
import { hashPin, verifyPin } from '@/lib/pin';

// Worker interface matching the old Firebase structure (for backward compatibility)
export interface Worker {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  employeeId?: string;
  roleAssignments: Array<{
    branchId: string;
    role: 'manager' | 'worker';
    assignedAt: Date;
    assignedBy: string;
    isActive: boolean;
  }>;
  isOwner: boolean;
  currentStatus?: 'clocked_in' | 'clocked_out';
  currentBranchId?: string;
  lastTimeIn?: Date;
  lastTimeOut?: Date;
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
    branchAssignments?: Array<{ branchId: string; role: 'manager' | 'worker' }>;
    phoneNumber?: string;
    employeeId?: string;
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
        phone_number: userData.phoneNumber,
        employee_id: userData.employeeId,
        is_owner: userData.isOwner || false,
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

  // Get worker by user ID
  getWorker: async (userId: string): Promise<Worker | null> => {
    try {
      // Get user profile with role assignments
      const { user, error } = await userProfileRepository.getWithRoles(userId);

      if (error || !user) {
        console.error('Error fetching worker:', error);
        return null;
      }

      // Get attendance status (for non-owners)
      let currentStatus: 'clocked_in' | 'clocked_out' | undefined;
      let currentBranchId: string | undefined;
      let lastTimeIn: Date | undefined;
      let lastTimeOut: Date | undefined;

      if (!user.is_owner) {
        // Get active attendance if any
        const { attendance: activeAttendance } = await attendanceService.getActiveAttendance(userId);
        if (activeAttendance) {
          currentStatus = 'clocked_in';
          currentBranchId = activeAttendance.branch_id;
          lastTimeIn = new Date(activeAttendance.clock_in);
        } else {
          currentStatus = 'clocked_out';
        }
      }

      // Convert to Worker format
      const worker: Worker = {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phone_number,
        employeeId: user.employee_id,
        roleAssignments: user.roleAssignments.map(ra => ({
          branchId: ra.branchId,
          role: ra.role,
          assignedAt: new Date(ra.assignedAt),
          assignedBy: '', // Not tracked in new schema
          isActive: ra.isActive,
        })),
        isOwner: user.is_owner,
        currentStatus,
        currentBranchId,
        lastTimeIn,
        lastTimeOut,
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
      if (updates.phoneNumber !== undefined) profileUpdates.phone_number = updates.phoneNumber;
      if (updates.employeeId !== undefined) profileUpdates.employee_id = updates.employeeId;
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
    role?: 'manager' | 'worker';
    status?: 'clocked_in' | 'clocked_out';
    searchQuery?: string;
    limit?: number;
  }): Promise<Worker[]> => {
    try {
      const { profiles, error } = await userProfileRepository.getActive();

      if (error) {
        console.error('Error listing workers:', error);
        return [];
      }

      // Get all workers and convert to Worker format
      const workers: Worker[] = [];

      for (const profile of profiles) {
        const worker = await workerService.getWorker(profile.id);
        if (worker) {
          workers.push(worker);
        }
      }

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

      if (filters?.status) {
        filtered = filtered.filter(w => w.currentStatus === filters.status);
      }

      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(w =>
          w.name.toLowerCase().includes(searchTerm) ||
          w.email.toLowerCase().includes(searchTerm) ||
          w.employeeId?.toLowerCase().includes(searchTerm)
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

  // Get clocked-in workers
  getClockedInWorkers: async (branchId: string): Promise<Worker[]> => {
    return workerService.listWorkers({ branchId, status: 'clocked_in' });
  },

  // Assign worker to branch
  assignWorkerToBranch: async (
    userId: string,
    branchId: string,
    role: 'manager' | 'worker'
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
    newRole: 'manager' | 'worker'
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
      await userProfileRepository.update(userId, { is_owner: true });
    } catch (error) {
      console.error('Error promoting to owner:', error);
      throw error;
    }
  },

  // Demote from owner
  demoteFromOwner: async (userId: string): Promise<void> => {
    try {
      await userProfileRepository.update(userId, { is_owner: false });
    } catch (error) {
      console.error('Error demoting from owner:', error);
      throw error;
    }
  },

  // PIN Management
  setWorkerPin: async (userId: string, pin: string): Promise<void> => {
    try {
      const hashedPin = await hashPin(pin);
      
      // Update all worker records for this user
      const { profiles } = await userProfileRepository.getActive();
      const userProfile = profiles.find(p => p.id === userId);
      
      if (!userProfile) {
        throw new Error('User not found');
      }

      // Get all worker records for this user
      const { user } = await userProfileRepository.getWithRoles(userId);
      if (user) {
        for (const ra of user.roleAssignments) {
          const { workers } = await workerRepository.getByBranch(ra.branchId);
          const worker = workers.find(w => w.user_id === userId);
          if (worker) {
            await workerRepository.update(worker.id, {
              pin: hashedPin,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error setting worker PIN:', error);
      throw error;
    }
  },

  verifyWorkerPin: async (userId: string, pin: string): Promise<boolean> => {
    try {
      // Get any worker record for this user to check PIN
      const { user } = await userProfileRepository.getWithRoles(userId);
      
      if (!user || user.roleAssignments.length === 0) {
        return false;
      }

      const firstBranch = user.roleAssignments[0].branchId;
      const { workers } = await workerRepository.getByBranch(firstBranch);
      const worker = workers.find(w => w.user_id === userId);

      if (!worker || !worker.pin) {
        return false;
      }

      return await verifyPin(pin, worker.pin);
    } catch (error) {
      console.error('Error verifying worker PIN:', error);
      return false;
    }
  },

  hasPin: async (userId: string): Promise<boolean> => {
    try {
      const { user } = await userProfileRepository.getWithRoles(userId);
      
      if (!user || user.roleAssignments.length === 0) {
        return false;
      }

      const firstBranch = user.roleAssignments[0].branchId;
      const { workers } = await workerRepository.getByBranch(firstBranch);
      const worker = workers.find(w => w.user_id === userId);

      return !!(worker && worker.pin);
    } catch (error) {
      console.error('Error checking worker PIN:', error);
      return false;
    }
  },

  resetWorkerPin: async (userId: string): Promise<void> => {
    try {
      // Clear PIN from all worker records
      const { user } = await userProfileRepository.getWithRoles(userId);
      
      if (user) {
        for (const ra of user.roleAssignments) {
          const { workers } = await workerRepository.getByBranch(ra.branchId);
          const worker = workers.find(w => w.user_id === userId);
          if (worker) {
            await workerRepository.update(worker.id, {
              pin: undefined,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error resetting worker PIN:', error);
      throw error;
    }
  },

  // Worker Stats
  getWorkerStats: async (userId: string): Promise<any> => {
    // Delegate to attendanceService for statistics
    // This can be enhanced with more business logic
    return {
      userId,
      // Add stats calculation logic here
    };
  },
};
