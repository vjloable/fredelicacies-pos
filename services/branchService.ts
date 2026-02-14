import { branchRepository } from '@/lib/repositories';
import type { Branch, CreateBranchData, UpdateBranchData } from '@/types/domain';

// Re-export types for convenience
export type { Branch, CreateBranchData, UpdateBranchData };

export const branchService = {
  // Get all branches (owner only - RLS handles filtering)
  getAllBranches: async (): Promise<{ branches: Branch[]; error: any }> => {
    return await branchRepository.getAll();
  },

  // Get specific branch by ID
  getBranchById: async (branchId: string): Promise<{ branch: Branch | null; error: any }> => {
    return await branchRepository.getById(branchId);
  },

  // Create new branch (owner only)
  createBranch: async (ownerId: string, branchData: CreateBranchData): Promise<{ id: string | null; error: any }> => {
    const { branch, error } = await branchRepository.create(ownerId, branchData);
    return { id: branch?.id || null, error };
  },

  // Update branch (owner/manager only)
  updateBranch: async (branchId: string, updates: UpdateBranchData): Promise<{ branch: Branch | null; error: any }> => {
    return await branchRepository.update(branchId, updates);
  },

  // Delete branch (admin only)
  deleteBranch: async (branchId: string): Promise<{ error: any }> => {
    return await branchRepository.delete(branchId);
  },

  // Soft delete branch (set status to inactive)
  deactivateBranch: async (branchId: string): Promise<{ branch: Branch | null; error: any }> => {
    return await branchRepository.update(branchId, { status: 'inactive' });
  },

  // Reactivate branch
  activateBranch: async (branchId: string): Promise<{ branch: Branch | null; error: any }> => {
    return await branchRepository.update(branchId, { status: 'active' });
  },

  // Real-time listener for branches
  subscribeToBranches: (callback: (branches: Branch[]) => void): (() => void) => {
    return branchRepository.subscribe(callback);
  },
};
