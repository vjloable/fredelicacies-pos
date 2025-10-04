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
	isAdmin: boolean;
}

export interface RoleAssignment {
	branchId: string;
	role: "manager" | "worker";
	assignedAt?: any; // Firestore Timestamp
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
	isUserAdmin: () => boolean;
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
	canAssignToAdmin: () => boolean;
	hasWorkerManagementAccess: () => boolean;
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
					let userData = await authService.getUserData(firebaseUser.uid);

					// If no user data exists, create a basic user profile
					if (!userData) {
						console.log(
							"No user data found, creating basic profile for:",
							firebaseUser.email
						);
						await authService.createUserProfile(firebaseUser.uid, {
							name:
								firebaseUser.displayName ||
								firebaseUser.email?.split("@")[0] ||
								"User",
							email: firebaseUser.email || "",
							isAdmin: false,
							roleAssignments: [],
						});
						// Fetch the newly created user data
						userData = await authService.getUserData(firebaseUser.uid);
					}

					if (userData) {
						const extendedUser: User = {
							...firebaseUser,
							roleAssignments: userData.roleAssignments,
							isAdmin: userData.isAdmin,
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

	const isUserAdmin = () => {
		return user?.isAdmin || false;
	};

	const canAccessBranch = (branchId: string) => {
		if (!user) return false;
		if (user.isAdmin) return true;
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
					isAdmin: userData.isAdmin,
				};
				setUser(extendedUser);
			}
		}
	};

	// Worker Management helper methods
	const isManager = () => {
		if (!user) return false;
		return user.roleAssignments.some(
			(assignment) =>
				assignment.role === "manager" && assignment.isActive !== false
		);
	};

	const isWorker = () => {
		if (!user) return false;
		return (
			user.roleAssignments.some(
				(assignment) =>
					assignment.role === "worker" && assignment.isActive !== false
			) && !user.isAdmin
		);
	};

	const canManageWorkers = () => {
		if (!user) return false;
		return user.isAdmin || isManager();
	};

	const getAccessibleBranches = () => {
		if (!user) return [];
		if (user.isAdmin) {
			// Admin can access all branches - this would need to be fetched from branch service
			// For now, return all assigned branches as a starting point
			return user.roleAssignments
				.filter((assignment) => assignment.isActive !== false)
				.map((assignment) => assignment.branchId);
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

		// Admins can manage anyone
		if (user.isAdmin) return true;

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
		// Only admins can delete workers
		return user.isAdmin;
	};

	const canAssignToAdmin = () => {
		if (!user) return false;
		// Only admins can assign admin roles
		return user.isAdmin;
	};

	const hasWorkerManagementAccess = () => {
		if (!user) return false;
		// Workers cannot access worker management at all
		return user.isAdmin || isManager();
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
		isUserAdmin,
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
		canAssignToAdmin,
		hasWorkerManagementAccess,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
