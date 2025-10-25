"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
	User as FirebaseUser,
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	setPersistence,
	browserLocalPersistence,
} from "firebase/auth";
import { auth } from "@/firebase-config";
import { authService } from "@/services/authService";

export interface User extends FirebaseUser {
	name?: string;
	roleAssignments: RoleAssignment[];
	isOwner: boolean;
}

export interface RoleAssignment {
	branchId: string;
	role: "manager" | "worker";
	assignedAt?: Date | { toDate: () => Date }; // Firestore Timestamp or Date
	assignedBy?: string;
	isActive?: boolean;
}

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
		setPersistence(auth, browserLocalPersistence);

		const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
			setLoading(true);

			if (firebaseUser) {
				try {
					const userData = await authService.getUserData(firebaseUser.uid);

					// If no user data exists, it means the user was deleted from Firestore
					// but the Firebase Auth session is still active. Force logout.
					if (!userData) {
						console.log(
							"User data not found for authenticated user. This usually means the user was deleted. Forcing logout."
						);
						await signOut(auth);
						setUser(null);
						setLoading(false);
						return;
					}

					if (userData) {
						const extendedUser: User = {
							...firebaseUser,
							roleAssignments: userData.roleAssignments,
							isOwner: userData.isOwner,
							name: userData.name,
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
			await signInWithEmailAndPassword(auth, email, password);
		} catch (error) {
			setLoading(false);
			throw error;
		}
	};

	const logout = async () => {
		setLoading(true);
		try {
			await signOut(auth);
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
		return user?.isOwner || false;
	};

	// Backward compatibility
	const isUserAdmin = () => {
		return user?.isOwner || false;
	};

	const canAccessBranch = (branchId: string) => {
		if (!user) return false;
		if (user.isOwner) return true;
		return user.roleAssignments.some(
			(assignment) =>
				assignment.branchId === branchId && assignment.isActive !== false
		);
	};

	const refreshUserData = async () => {
		if (user) {
			const userData = await authService.getUserData(user.uid);
			if (userData) {
				const extendedUser: User = {
					...user,
					roleAssignments: userData.roleAssignments,
					isOwner: userData.isOwner,
				};
				setUser(extendedUser);
			}
		}
	};

	// Worker Management helper methods
	const isManager = () => {
		if (!user) return false;
		// Owners are above managers in hierarchy, so they're not "managers"
		if (user.isOwner) return false;
		return user.roleAssignments.some(
			(assignment) =>
				assignment.role === "manager" && assignment.isActive !== false
		);
	};

	const isWorker = () => {
		if (!user) return false;
		// Owners are never considered "workers" - they are above the hierarchy
		if (user.isOwner) return false;
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
		return user.isOwner || isManager();
	};

	const getAccessibleBranches = () => {
		if (!user) return [];
		if (user.isOwner) {
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
		if (user.isOwner) return true;

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
		return user.isOwner;
	};

	const canAssignToOwner = () => {
		if (!user) return false;
		// Only owners can assign owner roles
		return user.isOwner;
	};

	const hasWorkerManagementAccess = () => {
		if (!user) return false;
		// Workers cannot access worker management at all
		return user.isOwner || isManager();
	};

	// Role hierarchy helpers
	const getUserHierarchyLevel = (): "owner" | "manager" | "worker" | null => {
		if (!user) return null;

		// Owner is the highest level
		if (user.isOwner) return "owner";

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
