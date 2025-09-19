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
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	isAuthenticated: boolean;

	getUserRoleForBranch: (branchId: string) => "manager" | "worker" | null;
	getAssignedBranches: () => string[];
	isUserAdmin: () => boolean;
	canAccessBranch: (branchId: string) => boolean;
	refreshUserData: () => Promise<void>;
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
			(a) => a.branchId === branchId
		);
		return assignment?.role || null;
	};

	const getAssignedBranches = () => {
		if (!user) return [];
		return user.roleAssignments.map((assignment) => assignment.branchId);
	};

	const isUserAdmin = () => {
		return user?.isAdmin || false;
	};

	const canAccessBranch = (branchId: string) => {
		if (!user) return false;
		if (user.isAdmin) return true;
		return user.roleAssignments.some(
			(assignment) => assignment.branchId === branchId
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

	const value = {
		user,
		loading,
		login,
		logout,
		isAuthenticated: !!user,
		getUserRoleForBranch,
		getAssignedBranches,
		isUserAdmin,
		canAccessBranch,
		refreshUserData,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
