"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { branchService, Branch } from "@/services/branchService";

interface BranchContextType {
  currentBranch: Branch | null;
  availableBranches: Branch[];
  loading: boolean;
  error: string | null;
  
  // Functions
  setCurrentBranchId: (branchId: string) => void;
  refreshBranches: () => Promise<void>;
  canUserAccessBranch: (branchId: string) => boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}

interface BranchProviderProps {
  children: React.ReactNode;
  initialBranchId?: string; // For URL-based branch selection
}

export function BranchProvider({ children, initialBranchId }: BranchProviderProps) {
  const { user, isUserAdmin, getAssignedBranches, canAccessBranch } = useAuth();
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load branches based on user role
  const loadBranches = async () => {
    if (!user) {
      setAvailableBranches([]);
      setCurrentBranch(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let branches: Branch[];
      
      if (isUserAdmin()) {
        // Admin can see all branches
        branches = await branchService.getAllBranches();
      } else {
        // Regular users can only see their assigned branches
        const userRoleAssignments = user.roleAssignments.map(assignment => ({
          branchId: assignment.branchId,
          role: assignment.role
        }));
        branches = await branchService.getUserBranches(userRoleAssignments);
      }

      setAvailableBranches(branches);

      // Set current branch
      if (initialBranchId && branches.find(b => b.id === initialBranchId)) {
        // Use the branch from URL if valid
        const branch = branches.find(b => b.id === initialBranchId);
        setCurrentBranch(branch || null);
      } else if (branches.length > 0) {
        // Default to first available branch
        setCurrentBranch(branches[0]);
      } else {
        setCurrentBranch(null);
      }

    } catch (err) {
      console.error("Error loading branches:", err);
      setError("Failed to load branches");
      setAvailableBranches([]);
      setCurrentBranch(null);
    } finally {
      setLoading(false);
    }
  };

  // Load branches when user changes or component mounts
  useEffect(() => {
    loadBranches();
  }, [user, initialBranchId]);

  // Function to set current branch by ID
  const setCurrentBranchId = (branchId: string) => {
    const branch = availableBranches.find(b => b.id === branchId);
    if (branch && canUserAccessBranch(branchId)) {
      setCurrentBranch(branch);
    } else {
      console.warn(`Cannot access branch ${branchId} or branch not found`);
    }
  };

  // Function to refresh branches
  const refreshBranches = async () => {
    await loadBranches();
  };

  // Function to check if user can access a specific branch
  const canUserAccessBranch = (branchId: string): boolean => {
    return canAccessBranch(branchId);
  };

  const value: BranchContextType = {
    currentBranch,
    availableBranches,
    loading,
    error,
    setCurrentBranchId,
    refreshBranches,
    canUserAccessBranch,
  };

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}