import {
	CreateWorkerRequest,
	WorkerFilters,
	UserRole,
	WorkSession,
	DateRange,
	WorkerStats,
} from "@/types/WorkerTypes";
import { authService } from "./authService";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	limit,
	startAfter,
	addDoc,
	setDoc,
	Timestamp,
	writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase-config";
import { deleteUser } from "firebase/auth";

// Worker interface matching the User structure with additional fields
export interface Worker {
	id: string;
	name: string;
	email: string;
	phoneNumber?: string;
	employeeId?: string;
	roleAssignments: Array<{
		branchId: string;
		role: "manager" | "worker";
		assignedAt: Date;
		assignedBy: string;
		isActive: boolean;
	}>;
	isAdmin: boolean;
	adminAssignedBy?: string;
	adminAssignedAt?: Date;
	currentStatus?: "clocked_in" | "clocked_out"; // Optional - admins don't have status tracking
	currentBranchId?: string;
	lastTimeIn?: Date;
	lastTimeOut?: Date;
	profilePicture?: string;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string;
	isActive: boolean;
	lastLoginAt?: Date;
	passwordResetRequired?: boolean;
	twoFactorEnabled?: boolean;
}

export interface WorkerService {
	// User CRUD Operations
	createWorker: (userData: CreateWorkerRequest) => Promise<string>; // Returns userId
	getWorker: (userId: string) => Promise<Worker | null>;
	updateWorker: (userId: string, updates: Partial<Worker>) => Promise<void>;
	deleteWorker: (userId: string) => Promise<void>;
	listWorkers: (filters?: WorkerFilters) => Promise<Worker[]>;

	// Branch-specific operations
	getWorkersByBranch: (branchId: string) => Promise<Worker[]>;
	assignWorkerToBranch: (
		userId: string,
		branchId: string,
		role: UserRole
	) => Promise<void>;
	removeWorkerFromBranch: (userId: string, branchId: string) => Promise<void>;

	// Role Management
	updateWorkerRole: (
		userId: string,
		branchId: string,
		newRole: UserRole
	) => Promise<void>;
	promoteToAdmin: (userId: string) => Promise<void>;
	demoteFromAdmin: (userId: string) => Promise<void>;

	// Time In/Time Out Management
	timeInWorker: (
		userId: string,
		branchId: string,
		notes?: string
	) => Promise<string>; // Returns sessionId
	timeOutWorker: (
		userId: string,
		sessionId: string,
		notes?: string
	) => Promise<void>;
	getClockedInWorkers: (branchId: string) => Promise<Worker[]>;
	getWorkSession: (sessionId: string) => Promise<WorkSession | null>;

	// Reporting & Analytics
	getWorkerWorkHistory: (
		userId: string,
		dateRange?: DateRange
	) => Promise<WorkSession[]>;
	getBranchWorkSessions: (
		branchId: string,
		dateRange?: DateRange
	) => Promise<WorkSession[]>;
	getWorkerStats: (userId: string) => Promise<WorkerStats>;
}

export const workerService: WorkerService = {
	createWorker: async (userData: CreateWorkerRequest): Promise<string> => {
		try {
			// Create Firebase Auth account
			const user = await authService.createUserAccount({
				name: userData.name,
				email: userData.email,
				password: userData.password,
			});

			if (user) {
				// Create user profile in Firestore with worker details
				await authService.createUserProfile(user.uid, {
					name: userData.name,
					email: userData.email,
					isAdmin: userData.isAdmin || false,
					roleAssignments: userData.branchAssignments,
				});

				// Update with additional worker fields
				const userDocRef = doc(db, "users", user.uid);
				await updateDoc(userDocRef, {
					name: userData.name,
					email: userData.email,
					phoneNumber: userData.phoneNumber,
					employeeId: userData.employeeId,
					isAdmin: userData.isAdmin || false,
					roleAssignments: userData.branchAssignments.map((assignment) => ({
						...assignment,
						assignedAt: Timestamp.now(),
						assignedBy: user.uid, // In real scenario, this would be the current user's ID
						isActive: true,
					})),
					// Admins don't have currentStatus - only regular workers do
					...(userData.isAdmin ? {} : { currentStatus: "clocked_out" }),
					isActive: true,
					createdAt: Timestamp.now(),
					updatedAt: Timestamp.now(),
					createdBy: user.uid, // In real scenario, this would be the current user's ID
					passwordResetRequired: false,
					twoFactorEnabled: false,
				});

				return user.uid;
			}

			throw new Error("Failed to create Firebase Auth user");
		} catch (error) {
			console.error("Error creating worker:", error);
			throw error;
		}
	},

	getWorker: async (userId: string): Promise<Worker | null> => {
		try {
			const userDocRef = doc(db, "users", userId);
			const userDocSnap = await getDoc(userDocRef);

			if (userDocSnap.exists()) {
				const data = userDocSnap.data();
				return {
					id: userId,
					name: data.name || "",
					email: data.email || "",
					phoneNumber: data.phoneNumber,
					employeeId: data.employeeId,
					roleAssignments: data.roleAssignments || [],
					isAdmin: data.isAdmin || false,
					adminAssignedBy: data.adminAssignedBy,
					adminAssignedAt: data.adminAssignedAt?.toDate(),
					currentStatus: data.isAdmin
						? undefined
						: data.currentStatus || "clocked_out",
					currentBranchId: data.currentBranchId,
					lastTimeIn: data.lastTimeIn?.toDate(),
					lastTimeOut: data.lastTimeOut?.toDate(),
					profilePicture: data.profilePicture,
					createdAt: data.createdAt?.toDate() || new Date(),
					updatedAt: data.updatedAt?.toDate() || new Date(),
					createdBy: data.createdBy || "",
					isActive: data.isActive !== false, // Default to true if not set
					lastLoginAt: data.lastLoginAt?.toDate(),
					passwordResetRequired: data.passwordResetRequired || false,
					twoFactorEnabled: data.twoFactorEnabled || false,
				} as Worker;
			}

			return null;
		} catch (error) {
			console.error("Error fetching worker:", error);
			throw error;
		}
	},

	updateWorker: async (
		userId: string,
		updates: Partial<Worker>
	): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);

			// Convert dates to Timestamps for Firestore
			const firestoreUpdates: any = { ...updates };

			if (updates.adminAssignedAt) {
				firestoreUpdates.adminAssignedAt = Timestamp.fromDate(
					updates.adminAssignedAt
				);
			}
			if (updates.lastTimeIn) {
				firestoreUpdates.lastTimeIn = Timestamp.fromDate(updates.lastTimeIn);
			}
			if (updates.lastTimeOut) {
				firestoreUpdates.lastTimeOut = Timestamp.fromDate(updates.lastTimeOut);
			}
			if (updates.createdAt) {
				firestoreUpdates.createdAt = Timestamp.fromDate(updates.createdAt);
			}
			if (updates.lastLoginAt) {
				firestoreUpdates.lastLoginAt = Timestamp.fromDate(updates.lastLoginAt);
			}

			// Always update the updatedAt timestamp
			firestoreUpdates.updatedAt = Timestamp.now();

			// Remove the id field from updates as it shouldn't be updated
			delete firestoreUpdates.id;

			await updateDoc(userDocRef, firestoreUpdates);
		} catch (error) {
			console.error("Error updating worker:", error);
			throw error;
		}
	},

	deleteWorker: async (userId: string): Promise<void> => {
		try {
			const batch = writeBatch(db);

			// Delete user document from Firestore
			const userDocRef = doc(db, "users", userId);
			batch.delete(userDocRef);

			// Delete all work sessions for this user
			const workSessionsRef = collection(db, "workSessions");
			const sessionQuery = query(
				workSessionsRef,
				where("userId", "==", userId)
			);
			const sessionSnapshot = await getDocs(sessionQuery);

			sessionSnapshot.forEach((doc) => {
				batch.delete(doc.ref);
			});

			// Commit the batch
			await batch.commit();

			// Note: Firebase Auth user deletion would typically be handled separately
			// by an admin SDK in a Cloud Function for security reasons
			console.log(
				`Worker ${userId} deleted from Firestore. Firebase Auth deletion should be handled by admin.`
			);
		} catch (error) {
			console.error("Error deleting worker:", error);
			throw error;
		}
	},

	listWorkers: async (filters?: WorkerFilters): Promise<Worker[]> => {
		try {
			const usersRef = collection(db, "users");
			let q = query(usersRef, orderBy("name"));

			// Apply filters
			if (filters?.branchId) {
				q = query(
					q,
					where("roleAssignments", "array-contains", {
						branchId: filters.branchId,
					})
				);
			}

			if (filters?.status) {
				// Only filter by status for non-admin users (admins don't have currentStatus)
				q = query(
					q,
					where("isAdmin", "==", false),
					where("currentStatus", "==", filters.status)
				);
			}

			// Apply pagination
			if (filters?.limit) {
				q = query(q, limit(filters.limit));
			}

			const querySnapshot = await getDocs(q);
			const workers: Worker[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();

				// Apply search filter locally (since Firestore doesn't support full-text search)
				if (filters?.searchQuery) {
					const searchTerm = filters.searchQuery.toLowerCase();
					const matchesSearch =
						data.name?.toLowerCase().includes(searchTerm) ||
						data.email?.toLowerCase().includes(searchTerm) ||
						data.employeeId?.toLowerCase().includes(searchTerm);

					if (!matchesSearch) return;
				}

				// Apply role filter locally
				if (filters?.role) {
					if (filters.role === "admin" && !data.isAdmin) return;
					if (filters.role !== "admin") {
						const hasRole = data.roleAssignments?.some(
							(assignment: any) => assignment.role === filters.role
						);
						if (!hasRole) return;
					}
				}

				workers.push({
					id: doc.id,
					name: data.name || "",
					email: data.email || "",
					phoneNumber: data.phoneNumber,
					employeeId: data.employeeId,
					roleAssignments: data.roleAssignments || [],
					isAdmin: data.isAdmin || false,
					adminAssignedBy: data.adminAssignedBy,
					adminAssignedAt: data.adminAssignedAt?.toDate(),
					currentStatus: data.isAdmin
						? undefined
						: data.currentStatus || "clocked_out",
					currentBranchId: data.currentBranchId,
					lastTimeIn: data.lastTimeIn?.toDate(),
					lastTimeOut: data.lastTimeOut?.toDate(),
					profilePicture: data.profilePicture,
					createdAt: data.createdAt?.toDate() || new Date(),
					updatedAt: data.updatedAt?.toDate() || new Date(),
					createdBy: data.createdBy || "",
					isActive: data.isActive !== false,
					lastLoginAt: data.lastLoginAt?.toDate(),
					passwordResetRequired: data.passwordResetRequired || false,
					twoFactorEnabled: data.twoFactorEnabled || false,
				});
			});

			return workers;
		} catch (error) {
			console.error("Error listing workers:", error);
			throw error;
		}
	},

	getWorkersByBranch: async (branchId: string): Promise<Worker[]> => {
		try {
			return await workerService.listWorkers({ branchId });
		} catch (error) {
			console.error("Error getting workers by branch:", error);
			throw error;
		}
	},

	assignWorkerToBranch: async (
		userId: string,
		branchId: string,
		role: UserRole
	): Promise<void> => {
		try {
			await authService.assignUserToBranch(
				userId,
				branchId,
				role as "manager" | "worker"
			);
		} catch (error) {
			console.error("Error assigning worker to branch:", error);
			throw error;
		}
	},

	removeWorkerFromBranch: async (
		userId: string,
		branchId: string
	): Promise<void> => {
		try {
			await authService.removeUserFromBranch(userId, branchId);
		} catch (error) {
			console.error("Error removing worker from branch:", error);
			throw error;
		}
	},

	updateWorkerRole: async (
		userId: string,
		branchId: string,
		newRole: UserRole
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Find and update the existing assignment while preserving metadata
			const updatedAssignments = userData.roleAssignments.map((assignment) => {
				if (assignment.branchId === branchId) {
					return {
						...assignment,
						role: newRole as "manager" | "worker",
					};
				}
				return assignment;
			});

			await authService.updateUserRoles(userId, updatedAssignments);
		} catch (error) {
			console.error("Error updating worker role:", error);
			throw error;
		}
	},

	promoteToAdmin: async (userId: string): Promise<void> => {
		try {
			await authService.promoteToAdmin(userId);
		} catch (error) {
			console.error("Error promoting worker to admin:", error);
			throw error;
		}
	},

	demoteFromAdmin: async (userId: string): Promise<void> => {
		try {
			await authService.demoteFromAdmin(userId);
		} catch (error) {
			console.error("Error demoting worker from admin:", error);
			throw error;
		}
	},

	timeInWorker: async (
		userId: string,
		branchId: string,
		notes?: string
	): Promise<string> => {
		try {
			// Create new work session
			const workSessionsRef = collection(db, "workSessions");
			const sessionData = {
				userId,
				branchId,
				timeInAt: Timestamp.now(),
				clockedInBy: userId, // In a real scenario, this would be the manager's ID
				notes: notes || "",
				timeOutAt: null,
				sessionType: "scheduled" as const,
			};

			const sessionDoc = await addDoc(workSessionsRef, sessionData);

			// Update user's current status
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				currentStatus: "clocked_in",
				currentBranchId: branchId,
				lastTimeIn: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});

			return sessionDoc.id;
		} catch (error) {
			console.error("Error timing in worker:", error);
			throw error;
		}
	},

	timeOutWorker: async (
		userId: string,
		sessionId: string,
		notes?: string
	): Promise<void> => {
		try {
			const timeOutAt = Timestamp.now();

			// Update work session
			const sessionDocRef = doc(db, "workSessions", sessionId);
			const sessionSnap = await getDoc(sessionDocRef);

			if (!sessionSnap.exists()) {
				throw new Error("Work session not found");
			}

			const sessionData = sessionSnap.data();
			const timeInAt = sessionData.timeInAt;
			const duration = Math.floor((timeOutAt.seconds - timeInAt.seconds) / 60); // Duration in minutes

			await updateDoc(sessionDocRef, {
				timeOutAt,
				clockedOutBy: userId, // In a real scenario, this would be the manager's ID
				duration,
				notes: notes || sessionData.notes || "",
			});

			// Update user's current status
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				currentStatus: "clocked_out",
				currentBranchId: null,
				lastTimeOut: timeOutAt,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error timing out worker:", error);
			throw error;
		}
	},

	getClockedInWorkers: async (branchId: string): Promise<Worker[]> => {
		try {
			return await workerService.listWorkers({
				branchId,
				status: "clocked_in",
			});
		} catch (error) {
			console.error("Error getting clocked in workers:", error);
			throw error;
		}
	},

	getWorkSession: async (sessionId: string): Promise<WorkSession | null> => {
		try {
			const sessionDocRef = doc(db, "workSessions", sessionId);
			const sessionSnap = await getDoc(sessionDocRef);

			if (!sessionSnap.exists()) {
				return null;
			}

			const data = sessionSnap.data();
			return {
				userId: data.userId,
				branchId: data.branchId,
				timeInAt: data.timeInAt,
				timeOutAt: data.timeOutAt,
				clockedInBy: data.clockedInBy,
				clockedOutBy: data.clockedOutBy,
				duration: data.duration,
				notes: data.notes,
				sessionType: data.sessionType,
			} as WorkSession;
		} catch (error) {
			console.error("Error getting work session:", error);
			throw error;
		}
	},

	getWorkerWorkHistory: async (
		userId: string,
		dateRange?: DateRange
	): Promise<WorkSession[]> => {
		try {
			const workSessionsRef = collection(db, "workSessions");
			let q = query(
				workSessionsRef,
				where("userId", "==", userId),
				orderBy("timeInAt", "desc")
			);

			// Apply date range filter if provided
			if (dateRange) {
				q = query(
					q,
					where("timeInAt", ">=", dateRange.startDate),
					where("timeInAt", "<=", dateRange.endDate)
				);
			}

			const querySnapshot = await getDocs(q);
			const sessions: WorkSession[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				sessions.push({
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy,
					duration: data.duration,
					notes: data.notes,
					sessionType: data.sessionType,
				});
			});

			return sessions;
		} catch (error) {
			console.error("Error getting worker work history:", error);
			throw error;
		}
	},

	getBranchWorkSessions: async (
		branchId: string,
		dateRange?: DateRange
	): Promise<WorkSession[]> => {
		try {
			const workSessionsRef = collection(db, "workSessions");
			let q = query(
				workSessionsRef,
				where("branchId", "==", branchId),
				orderBy("timeInAt", "desc")
			);

			// Apply date range filter if provided
			if (dateRange) {
				q = query(
					q,
					where("timeInAt", ">=", dateRange.startDate),
					where("timeInAt", "<=", dateRange.endDate)
				);
			}

			const querySnapshot = await getDocs(q);
			const sessions: WorkSession[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				sessions.push({
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy,
					duration: data.duration,
					notes: data.notes,
					sessionType: data.sessionType,
				});
			});

			return sessions;
		} catch (error) {
			console.error("Error getting branch work sessions:", error);
			throw error;
		}
	},

	getWorkerStats: async (userId: string): Promise<WorkerStats> => {
		try {
			// Get all work sessions for this worker
			const allSessions = await workerService.getWorkerWorkHistory(userId);

			// Calculate date ranges
			const now = new Date();
			const startOfWeek = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - now.getDay()
			);
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

			let totalHoursWorked = 0;
			let totalSessions = allSessions.length;
			let weekHours = 0;
			let monthHours = 0;
			let weekSessions = 0;
			let monthSessions = 0;
			let weekDays = new Set<string>();
			let monthDays = new Set<string>();

			const branchStatsMap = new Map<
				string,
				{
					hoursWorked: number;
					sessionsCount: number;
					lastWorked?: Timestamp;
				}
			>();

			let lastSession: WorkerStats["lastSession"] | undefined;

			// Process each session
			allSessions.forEach((session) => {
				const sessionDate = session.timeInAt.toDate();
				const duration = session.duration || 0;
				const hours = duration / 60;

				// Total stats
				totalHoursWorked += hours;

				// Week stats
				if (sessionDate >= startOfWeek) {
					weekHours += hours;
					weekSessions++;
					weekDays.add(sessionDate.toDateString());
				}

				// Month stats
				if (sessionDate >= startOfMonth) {
					monthHours += hours;
					monthSessions++;
					monthDays.add(sessionDate.toDateString());
				}

				// Branch stats
				const branchId = session.branchId;
				const branchStats = branchStatsMap.get(branchId) || {
					hoursWorked: 0,
					sessionsCount: 0,
				};

				branchStats.hoursWorked += hours;
				branchStats.sessionsCount++;

				if (
					!branchStats.lastWorked ||
					sessionDate > branchStats.lastWorked.toDate()
				) {
					branchStats.lastWorked = session.timeInAt;
				}

				branchStatsMap.set(branchId, branchStats);

				// Last session (most recent)
				if (!lastSession || sessionDate > lastSession.timeInAt.toDate()) {
					lastSession = {
						timeInAt: session.timeInAt,
						timeOutAt: session.timeOutAt,
						branchId: session.branchId,
						duration: session.duration,
					};
				}
			});

			// Calculate averages and streaks
			const averageSessionDuration =
				totalSessions > 0 ? (totalHoursWorked * 60) / totalSessions : 0;

			// Note: Streak calculation would require more complex logic to check consecutive days
			// For now, using placeholder values
			const currentStreak = 0;
			const longestStreak = 0;

			// Convert branch stats map to array
			const branchStats = Array.from(branchStatsMap.entries()).map(
				([branchId, stats]) => ({
					branchId,
					hoursWorked: stats.hoursWorked,
					sessionsCount: stats.sessionsCount,
					lastWorked: stats.lastWorked,
				})
			);

			return {
				userId,
				totalHoursWorked,
				totalSessions,
				averageSessionDuration,
				currentStreak,
				longestStreak,
				thisWeek: {
					hoursWorked: weekHours,
					sessionsCount: weekSessions,
					daysWorked: weekDays.size,
				},
				thisMonth: {
					hoursWorked: monthHours,
					sessionsCount: monthSessions,
					daysWorked: monthDays.size,
				},
				lastSession,
				branchStats,
				overtime: {
					thisWeek: 0, // Would need business logic to determine overtime
					thisMonth: 0,
					total: 0,
				},
				attendance: {
					punctualityScore: 100, // Would need scheduled vs actual time data
					averageClockInDelay: 0,
					missedShifts: 0,
				},
			};
		} catch (error) {
			console.error("Error getting worker stats:", error);
			throw error;
		}
	},
};
