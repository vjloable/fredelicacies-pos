"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "@/services/authService";
import type { UserWithRoles, RoleAssignment } from "@/types/domain";

export interface User extends UserWithRoles {
  uid: string; // Alias for backward compatibility
}

export type { RoleAssignment };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;

  // Existing methods
  getUserRoleForBranch: (branchId: string) => "manager" | "worker" | null;
  getAssignedBranches: () => string[];
  isUserOwner: () => boolean;
  isUserAdmin: () => boolean; // Backward compatibility
  canAccessBranch: (branchId: string) => boolean;
  refreshUserData: () => Promise<void>;

  // Worker Management methods
  isManager: () => boolean;
  isWorker: () => boolean;
  canManageWorkers: () => boolean;
  getAccessibleBranches: () => string[];
  canManageWorker: (
    targetUserId: string,
    targetUserBranches: string[]
  ) => boolean;
  canCreateWorker: () => boolean;
  canDeleteWorker: () => boolean;
  canAssignToOwner: () => boolean;
  hasWorkerManagementAccess: () => boolean;

  // Role hierarchy helpers
  getUserHierarchyLevel: () => "owner" | "manager" | "worker" | null;
  canManageRole: (targetRole: "owner" | "manager" | "worker") => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange(async (session) => {
      setLoading(true);

      if (session) {
        try {
          const userData = await authService.getUserData(session.user.id);

          // If no user data exists, the user was deleted. Force logout.
          if (!userData) {
            console.log(
              "User data not found for authenticated user. This usually means the user was deleted. Forcing logout."
            );
            await authService.signOut();
            setUser(null);
            setLoading(false);
            return;
          }

          if (userData) {
            const extendedUser: User = {
              ...userData,
              uid: userData.id, // Backward compatibility
            };
            setUser(extendedUser);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await authService.signIn(email, password);
      if (error) {
        setLoading(false);
        throw error;
      }
      // Auth state change will trigger user load
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.signOut();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Helper methods that delegate to authService or use local user state
  const getUserRoleForBranch = (branchId: string) => {
    if (!user) return null;
    const assignment = user.roleAssignments.find(
      (a) => a.branchId === branchId && a.isActive !== false
    );
    return assignment?.role || null;
  };

  const getAssignedBranches = () => {
    if (!user) return [];
    return user.roleAssignments
      .filter((assignment) => assignment.isActive !== false)
      .map((assignment) => assignment.branchId);
  };

  const isUserOwner = () => {
    return user?.is_owner || false;
  };

  // Backward compatibility
  const isUserAdmin = () => {
    return user?.is_owner || false;
  };

  const canAccessBranch = (branchId: string) => {
    if (!user) return false;
    if (user.is_owner) return true;
    return user.roleAssignments.some(
      (assignment) =>
        assignment.branchId === branchId && assignment.isActive !== false
    );
  };

  const refreshUserData = async () => {
    if (user) {
      const userData = await authService.getUserData(user.id);
      if (userData) {
        const extendedUser: User = {
          ...userData,
          uid: userData.id,
        };
        setUser(extendedUser);
      }
    }
  };

  // Worker Management helper methods
  const isManager = () => {
    if (!user) return false;
    // Owners are above managers in hierarchy, so they're not "managers"
    if (user.is_owner) return false;
    return user.roleAssignments.some(
      (assignment) =>
        assignment.role === "manager" && assignment.isActive !== false
    );
  };

  const isWorker = () => {
    if (!user) return false;
    // Owners are never considered "workers" - they are above the hierarchy
    if (user.is_owner) return false;
    // Check if user has any worker role assignments (but no manager roles)
    const hasWorkerRole = user.roleAssignments.some(
      (assignment) =>
        assignment.role === "worker" && assignment.isActive !== false
    );
    const hasManagerRole = user.roleAssignments.some(
      (assignment) =>
        assignment.role === "manager" && assignment.isActive !== false
    );
    // Pure worker: has worker role but no manager role
    return hasWorkerRole && !hasManagerRole;
  };

  const canManageWorkers = () => {
    if (!user) return false;
    return user.is_owner || isManager();
  };

  const getAccessibleBranches = () => {
    if (!user) return [];
    if (user.is_owner) {
      // Owners have access to all branches but are not assigned to specific branches
      // They get access through their owner status, not through roleAssignments
      // For now, return empty array since admins should not be assigned to specific branches
      // In practice, owner access would be handled globally through branch service
      return [];
    }
    // Managers can only access branches they manage
    return user.roleAssignments
      .filter(
        (assignment) =>
          assignment.role === "manager" && assignment.isActive !== false
      )
      .map((assignment) => assignment.branchId);
  };

  const canManageWorker = (
    targetUserId: string,
    targetUserBranches: string[]
  ) => {
    if (!user || !canManageWorkers()) return false;

    // Owners can manage anyone
    if (user.is_owner) return true;

    // Managers can only manage workers in their branches
    const accessibleBranches = getAccessibleBranches();
    return targetUserBranches.some((branchId) =>
      accessibleBranches.includes(branchId)
    );
  };

  const canCreateWorker = () => {
    return canManageWorkers();
  };

  const canDeleteWorker = () => {
    if (!user) return false;
    // Only owners can delete workers
    return user.is_owner;
  };

  const canAssignToOwner = () => {
    if (!user) return false;
    // Only owners can assign owner roles
    return user.is_owner;
  };

  const hasWorkerManagementAccess = () => {
    if (!user) return false;
    // Workers cannot access worker management at all
    return user.is_owner || isManager();
  };

  // Role hierarchy helpers
  const getUserHierarchyLevel = (): "owner" | "manager" | "worker" | null => {
    if (!user) return null;

    // Owner is the highest level
    if (user.is_owner) return "owner";

    // Check for manager role
    const hasManagerRole = user.roleAssignments.some(
      (assignment) =>
        assignment.role === "manager" && assignment.isActive !== false
    );
    if (hasManagerRole) return "manager";

    // Check for worker role
    const hasWorkerRole = user.roleAssignments.some(
      (assignment) =>
        assignment.role === "worker" && assignment.isActive !== false
    );
    if (hasWorkerRole) return "worker";

    return null;
  };

  const canManageRole = (
    targetRole: "owner" | "manager" | "worker"
  ): boolean => {
    const currentLevel = getUserHierarchyLevel();
    if (!currentLevel) return false;

    // Hierarchy: owner > manager > worker
    // Each level can manage those below them
    if (currentLevel === "owner") {
      return targetRole === "manager" || targetRole === "worker";
    }
    if (currentLevel === "manager") {
      return targetRole === "worker";
    }
    // Workers cannot manage anyone
    return false;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    // Existing methods
    getUserRoleForBranch,
    getAssignedBranches,
    isUserOwner,
    isUserAdmin, // Backward compatibility
    canAccessBranch,
    refreshUserData,
    // Worker Management methods
    isManager,
    isWorker,
    canManageWorkers,
    getAccessibleBranches,
    canManageWorker,
    canCreateWorker,
    canDeleteWorker,
    canAssignToOwner,
    hasWorkerManagementAccess,
    // Role hierarchy helpers
    getUserHierarchyLevel,
    canManageRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
