"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authService } from "@/services/authService";
import type { UserWithRoles, RoleAssignment } from "@/types/domain";
import { logActivity } from "@/services/activityLogService";
import {
  type EffectiveRole,
  type Impersonation,
  PREVIEWABLE_ROLES,
  resolveRealRole,
  resolveEffectiveRole,
  canPreviewRoles,
  canManageRole as canManageRoleLadder,
  hasAllBranchAccess,
} from "@/lib/roles";

export interface User extends UserWithRoles {
  uid: string; // Alias for backward compatibility
}

export type { RoleAssignment };
export type { EffectiveRole, Impersonation };

const IMPERSONATION_KEY = "admin_role_preview";

// How long a loaded profile/role snapshot is trusted before the next auth event
// re-fetches it. Supabase already validates the JWT on its own cadence; this only
// throttles the extra DB round-trip for the profile + role assignments, so token
// refreshes and tab re-focus don't re-query on every event.
const USER_PROFILE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;

  // Role model
  realRole: EffectiveRole | null;      // the user's true role (ignores preview)
  effectiveRole: EffectiveRole | null; // the role currently in force (preview-aware)

  // Admin role-switch preview (impersonation)
  impersonation: Impersonation;
  canPreview: boolean;                 // true only for admins
  previewableRoles: readonly EffectiveRole[];
  startPreview: (assumedRole: EffectiveRole, opts?: { branchId?: string; workerId?: string }) => void;
  stopPreview: () => void;

  // Existing methods (branch role strings renamed to team_leader/cashier)
  getUserRoleForBranch: (branchId: string) => "team_leader" | "cashier" | null;
  getAssignedBranches: () => string[];
  isUserOwner: () => boolean;   // owner-level power (owner or admin), preview-aware
  isUserAdmin: () => boolean;   // true admin (privilege to preview), ignores preview
  canAccessBranch: (branchId: string) => boolean;
  refreshUserData: () => Promise<void>;

  // Elevated privileges at a branch (owner/admin/all-branch manager, or team leader of that branch)
  hasManagerPrivileges: (branchId?: string) => boolean;

  // Worker Management methods
  isManager: () => boolean;   // all-branch manager (preview-aware)
  isWorker: () => boolean;    // cashier (preview-aware) — back-compat alias of isCashier
  isCashier: () => boolean;
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
  getUserHierarchyLevel: () => EffectiveRole | null;
  canManageRole: (targetRole: EffectiveRole) => boolean;
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
  const [impersonation, setImpersonation] = useState<Impersonation>(null);
  const initialCheckDone = useRef(false);
  // Identity + freshness of the last profile load, so repeated auth events for the
  // same user (token refresh, tab focus) don't re-hit the DB until the TTL lapses.
  const loadedUserIdRef = useRef<string | null>(null);
  const loadedAtRef = useRef(0);

  // The user's real role (ignores preview) and the role currently in force.
  const realRole = user
    ? resolveRealRole(
        { is_admin: user.is_admin, is_owner: user.is_owner, is_manager: user.is_manager },
        user.roleAssignments
      )
    : null;
  const canPreview = canPreviewRoles(realRole);
  // Only admins may preview; drop any stale impersonation for non-admins.
  const activeImpersonation = canPreview ? impersonation : null;
  const effectiveRole = resolveEffectiveRole(realRole, activeImpersonation);

  // Restore a persisted preview once the (admin) user is known.
  useEffect(() => {
    if (!canPreview) {
      setImpersonation(null);
      return;
    }
    if (impersonation) return;
    try {
      const raw = sessionStorage.getItem(IMPERSONATION_KEY);
      if (raw) setImpersonation(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPreview]);

  const startPreview = useCallback(
    (assumedRole: EffectiveRole, opts?: { branchId?: string; workerId?: string }) => {
      if (!canPreview) return;
      const next: Impersonation = { assumedRole, branchId: opts?.branchId, workerId: opts?.workerId };
      setImpersonation(next);
      try {
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [canPreview]
  );

  const stopPreview = useCallback(() => {
    setImpersonation(null);
    try {
      sessionStorage.removeItem(IMPERSONATION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange(async (session) => {
      // Only show the loading screen on first check — subsequent token
      // refreshes (e.g. on tab refocus) should update silently
      if (!initialCheckDone.current) {
        setLoading(true);
      }

      if (session) {
        try {
          // Same user, and the last profile load is still within the TTL: this event
          // is just a token refresh or a tab re-focus, not a new sign-in. Skip the
          // profile/role re-fetch — the JWT is already validated by Supabase.
          const sameUser = loadedUserIdRef.current === session.user.id;
          const fresh = Date.now() - loadedAtRef.current < USER_PROFILE_TTL_MS;
          if (sameUser && fresh) {
            initialCheckDone.current = true;
            setLoading(false);
            return;
          }

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
            loadedUserIdRef.current = userData.id;
            loadedAtRef.current = Date.now();
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
        loadedUserIdRef.current = null;
        loadedAtRef.current = 0;
      }

      initialCheckDone.current = true;
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { session, error } = await authService.signIn(email, password);
      if (error) {
        setLoading(false);
        throw error;
      }
      // Fire-and-forget login log — fetch user data to know which branches to tag
      if (session?.user?.id) {
        void (async () => {
          const userData = await authService.getUserData(session.user.id);
          if (userData?.roleAssignments) {
            for (const ra of userData.roleAssignments) {
              void logActivity({ branchId: ra.branchId, userId: session.user.id, action: 'login', details: { name: userData.name } });
            }
          }
        })();
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
      // Log logout before session clears — user state still has branch info
      if (user) {
        for (const ra of user.roleAssignments) {
          void logActivity({ branchId: ra.branchId, userId: user.id, action: 'logout', details: { name: user.name } });
        }
      }
      await authService.signOut();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // ---- Role helpers (all preview-aware via effectiveRole) --------------------

  // Branch role from the user's assignments. While previewing team_leader/cashier,
  // the assumed role stands in for the previewed branch.
  const getUserRoleForBranch = (branchId: string): "team_leader" | "cashier" | null => {
    if (!user) return null;
    if (activeImpersonation && (effectiveRole === "team_leader" || effectiveRole === "cashier")) {
      return activeImpersonation.branchId === branchId ? effectiveRole : null;
    }
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

  // Owner-level power (owner or admin). Preview-aware: an admin previewing a lower
  // role loses owner power for the duration of the preview.
  const isUserOwner = () => effectiveRole === "owner" || effectiveRole === "admin";

  // A true admin (has the privilege to preview). Ignores preview so the switcher
  // never hides itself while previewing.
  const isUserAdmin = () => realRole === "admin";

  const isManager = () => effectiveRole === "manager";
  const isCashier = () => effectiveRole === "cashier";
  const isWorker = isCashier; // back-compat alias

  const canAccessBranch = (branchId: string) => {
    if (!user) return false;
    if (hasAllBranchAccess(effectiveRole)) return true;
    if (activeImpersonation) return activeImpersonation.branchId === branchId;
    return user.roleAssignments.some(
      (assignment) =>
        assignment.branchId === branchId && assignment.isActive !== false
    );
  };

  // Elevated privileges at a branch: owner/admin/all-branch manager everywhere,
  // or a team leader of that specific branch.
  const hasManagerPrivileges = (branchId?: string) => {
    if (!user) return false;
    if (hasAllBranchAccess(effectiveRole)) return true;
    if (!branchId) return effectiveRole === "team_leader";
    return getUserRoleForBranch(branchId) === "team_leader";
  };

  const refreshUserData = useCallback(async () => {
    if (user) {
      const userData = await authService.getUserData(user.id);
      // Explicit refresh (e.g. after an edit) resets the TTL window.
      loadedAtRef.current = Date.now();
      if (userData) {
        // Only update if data actually changed (deep comparison of relevant fields)
        const hasChanged =
          user.name !== userData.name ||
          user.profile_picture !== userData.profile_picture ||
          user.display_name !== userData.display_name ||
          user.is_owner !== userData.is_owner ||
          user.is_admin !== userData.is_admin ||
          user.is_manager !== userData.is_manager ||
          user.roleAssignments.length !== userData.roleAssignments.length ||
          JSON.stringify(user.roleAssignments) !== JSON.stringify(userData.roleAssignments);

        if (hasChanged) {
          const extendedUser: User = {
            ...userData,
            uid: userData.id,
          };
          setUser(extendedUser);
        }
      }
    }
  }, [user]);

  // ---- Worker/user management (owner/admin only, per product decision) --------
  const canManageWorkers = () => isUserOwner();

  const getAccessibleBranches = () => {
    if (!user) return [];
    // All-branch roles aren't pinned to specific branches (empty = "all"),
    // matching the historical owner semantics callers already handle.
    if (hasAllBranchAccess(effectiveRole)) return [];
    if (activeImpersonation?.branchId) return [activeImpersonation.branchId];
    return user.roleAssignments
      .filter((assignment) => assignment.isActive !== false)
      .map((assignment) => assignment.branchId);
  };

  const canManageWorker = (
    _targetUserId: string,
    _targetUserBranches: string[]
  ) => canManageWorkers();

  const canCreateWorker = () => canManageWorkers();
  const canDeleteWorker = () => isUserOwner();
  const canAssignToOwner = () => isUserOwner();
  const hasWorkerManagementAccess = () => canManageWorkers();

  // ---- Role hierarchy helpers ------------------------------------------------
  const getUserHierarchyLevel = (): EffectiveRole | null => effectiveRole;

  const canManageRole = (targetRole: EffectiveRole): boolean =>
    canManageRoleLadder(effectiveRole, targetRole);

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    // Role model
    realRole,
    effectiveRole,
    // Preview
    impersonation: activeImpersonation,
    canPreview,
    previewableRoles: PREVIEWABLE_ROLES,
    startPreview,
    stopPreview,
    // Existing methods
    getUserRoleForBranch,
    getAssignedBranches,
    isUserOwner,
    isUserAdmin,
    canAccessBranch,
    refreshUserData,
    hasManagerPrivileges,
    // Worker Management methods
    isManager,
    isWorker,
    isCashier,
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
