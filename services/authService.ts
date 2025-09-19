import { RoleAssignment } from "@/contexts/AuthContext";
import {
	collection,
	addDoc,
	getDocs,
	doc,
	deleteDoc,
	query,
	orderBy,
	onSnapshot,
	Timestamp,
	getDoc,
	updateDoc,
	setDoc,
} from "firebase/firestore";
import { db } from "@/firebase-config";

interface UserData {
	name: string;
	email: string;
	roleAssignments: RoleAssignment[];
	isAdmin: boolean;
	createdAt?: Timestamp;
	updatedAt?: Timestamp;
}

export const authService = {
	// User data management
	getUserData: async (userId: string): Promise<UserData | null> => {
		try {
			const userDocRef = doc(db, "users", userId);
			const userDocSnap = await getDoc(userDocRef);

			if (userDocSnap.exists()) {
				const data = userDocSnap.data();
				return {
					name: data.name || "",
					email: data.email || "",
					roleAssignments: data.roleAssignments || [],
					isAdmin: data.isAdmin || false,
					createdAt: data.createdAt,
					updatedAt: data.updatedAt,
				} as UserData;
			}

			return null;
		} catch (error) {
			console.error("Error fetching user data:", error);
			return null;
		}
	},

	updateUserRoles: async (
		userId: string,
		roleAssignments: RoleAssignment[]
	): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				roleAssignments,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error updating user roles:", error);
			throw error;
		}
	},

	// Branch assignment management
	assignUserToBranch: async (
		userId: string,
		branchId: string,
		role: "manager" | "worker"
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Remove existing assignment for this branch if any
			const filteredAssignments = userData.roleAssignments.filter(
				(assignment) => assignment.branchId !== branchId
			);

			// Add new assignment
			const newAssignments = [...filteredAssignments, { branchId, role }];

			await authService.updateUserRoles(userId, newAssignments);
		} catch (error) {
			console.error("Error assigning user to branch:", error);
			throw error;
		}
	},

	removeUserFromBranch: async (
		userId: string,
		branchId: string
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Remove assignment for this branch
			const filteredAssignments = userData.roleAssignments.filter(
				(assignment) => assignment.branchId !== branchId
			);

			await authService.updateUserRoles(userId, filteredAssignments);
		} catch (error) {
			console.error("Error removing user from branch:", error);
			throw error;
		}
	},

	// Admin operations
	promoteToAdmin: async (userId: string): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isAdmin: true,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error promoting user to admin:", error);
			throw error;
		}
	},

	demoteFromAdmin: async (userId: string): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isAdmin: false,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error demoting user from admin:", error);
			throw error;
		}
	},

	// User creation (for new user registration)
	createUserProfile: async (
		userId: string,
		userData: {
			name: string;
			email: string;
			isAdmin?: boolean;
			roleAssignments?: RoleAssignment[];
		}
	): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await setDoc(userDocRef, {
				name: userData.name,
				email: userData.email,
				isAdmin: userData.isAdmin || false,
				roleAssignments: userData.roleAssignments || [],
				createdAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error creating user profile:", error);
			throw error;
		}
	},
};
