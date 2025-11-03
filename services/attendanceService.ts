import { DateRange } from "@/types/WorkerTypes";
import {
	Timestamp,
	collection,
	doc,
	addDoc,
	getDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	getDocs,
	limit,
} from "firebase/firestore";
import { db } from "@/firebase-config";

export interface Attendance {
	userId: string;
	branchId: string;
	timeInAt: Timestamp;
	timeOutAt?: Timestamp;
	clockedInBy: string;
	clockedOutBy?: string;
	duration?: number;
	notes?: string;
	attendanceType: "scheduled" | "emergency" | "overtime";
}

export interface AttendanceService {
	// Core CRUD operations
	createAttendance: (attendanceData: Attendance) => Promise<string>; // Returns attendanceId
	getAttendance: (attendanceId: string) => Promise<Attendance | null>;
	updateAttendance: (
		attendanceId: string,
		updates: Partial<Attendance>
	) => Promise<void>;
	deleteAttendance: (attendanceId: string) => Promise<void>;
	listAttendances: (
		userId: string,
		dateRange?: DateRange
	) => Promise<Attendance[]>;

	// Time In/Out Operations
	timeInWorker: (
		userId: string,
		branchId: string,
		notes?: string
	) => Promise<string>; // Returns attendanceId
	timeOutWorker: (
		userId: string,
		attendanceId: string,
		notes?: string
	) => Promise<void>;

	// Utility methods
	getActiveAttendance: (
		userId: string
	) => Promise<(Attendance & { id: string }) | null>;
	getRecentAttendances: (
		userId: string,
		days?: number
	) => Promise<(Attendance & { id: string })[]>;
	getBranchAttendances: (
		branchId: string,
		dateRange?: DateRange
	) => Promise<Attendance[]>;
	calculateAttendanceDuration: (
		timeInAt: Timestamp,
		timeOutAt?: Timestamp
	) => number;
	getAttendancesByDateRange: (
		userId: string,
		startDate: Date,
		endDate: Date
	) => Promise<Attendance[]>;
}

export const attendanceService: AttendanceService = {
	createAttendance: async (attendanceData: Attendance): Promise<string> => {
		try {
			const attendanceRef = collection(db, "attendance");

			// Ensure timeInAt is a Timestamp
			const attendanceWithTimestamp = {
				...attendanceData,
				timeInAt:
					attendanceData.timeInAt instanceof Timestamp
						? attendanceData.timeInAt
						: Timestamp.fromDate(new Date()),
				timeOutAt: attendanceData.timeOutAt || null,
				createdAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			};

			const docRef = await addDoc(attendanceRef, attendanceWithTimestamp);
			return docRef.id;
		} catch (error) {
			console.error("Error creating attendance:", error);
			throw error;
		}
	},

	getAttendance: async (attendanceId: string): Promise<Attendance | null> => {
		try {
			const attendanceDocRef = doc(db, "attendance", attendanceId);
			const attendanceSnap = await getDoc(attendanceDocRef);

			if (!attendanceSnap.exists()) {
				return null;
			}

			const data = attendanceSnap.data();
			return {
				userId: data.userId,
				branchId: data.branchId,
				timeInAt: data.timeInAt,
				timeOutAt: data.timeOutAt || undefined,
				clockedInBy: data.clockedInBy,
				clockedOutBy: data.clockedOutBy || undefined,
				duration: data.duration || undefined,
				notes: data.notes || undefined,
				attendanceType: data.attendanceType,
			} as Attendance;
		} catch (error) {
			console.error("Error getting work attendance:", error);
			throw error;
		}
	},

	updateAttendance: async (
		attendanceId: string,
		updates: Partial<Attendance>
	): Promise<void> => {
		try {
			const attendanceDocRef = doc(db, "attendance", attendanceId);

			// Convert any Date objects to Timestamps
			const firestoreUpdates: any = { ...updates };

			if (updates.timeInAt && !(updates.timeInAt instanceof Timestamp)) {
				firestoreUpdates.timeInAt = Timestamp.fromDate(updates.timeInAt as any);
			}

			if (updates.timeOutAt && !(updates.timeOutAt instanceof Timestamp)) {
				firestoreUpdates.timeOutAt = Timestamp.fromDate(
					updates.timeOutAt as any
				);
			}

			// Always update the updatedAt timestamp
			firestoreUpdates.updatedAt = Timestamp.now();

			await updateDoc(attendanceDocRef, firestoreUpdates);
		} catch (error) {
			console.error("Error updating work attendance:", error);
			throw error;
		}
	},

	deleteAttendance: async (attendanceId: string): Promise<void> => {
		try {
			const attendanceDocRef = doc(db, "attendance", attendanceId);
			await deleteDoc(attendanceDocRef);
		} catch (error) {
			console.error("Error deleting work attendance:", error);
			throw error;
		}
	},

	listAttendances: async (
		userId: string,
		dateRange?: DateRange
	): Promise<Attendance[]> => {
		try {
			const attendanceRef = collection(db, "attendance");

			// Base query: filter by userId and order by timeInAt descending (most recent first)
			let q = query(
				attendanceRef,
				where("userId", "==", userId),
				orderBy("timeInAt", "desc")
			);

			// Apply date range filter if provided
			if (dateRange) {
				q = query(
					attendanceRef,
					where("userId", "==", userId),
					where("timeInAt", ">=", dateRange.startDate),
					where("timeInAt", "<=", dateRange.endDate),
					orderBy("timeInAt", "desc")
				);
			}

			const querySnapshot = await getDocs(q);
			const attendances: Attendance[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				attendances.push({
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt || undefined,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy || undefined,
					duration: data.duration || undefined,
					notes: data.notes || undefined,
					attendanceType: data.attendanceType,
				});
			});

			return attendances;
		} catch (error) {
			console.error("Error listing work attendances:", error);
			throw error;
		}
	},

	// Additional utility methods for common operations
	getActiveAttendance: async (
		userId: string
	): Promise<(Attendance & { id: string }) | null> => {
		try {
			const attendanceRef = collection(db, "attendance");
			const q = query(
				attendanceRef,
				where("userId", "==", userId),
				where("timeOutAt", "==", null),
				orderBy("timeInAt", "desc"),
				limit(1)
			);

			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				return null;
			}

			const docSnapshot = querySnapshot.docs[0];
			const data = docSnapshot.data();

			return {
				id: docSnapshot.id,
				userId: data.userId,
				branchId: data.branchId,
				timeInAt: data.timeInAt,
				timeOutAt: undefined,
				clockedInBy: data.clockedInBy,
				clockedOutBy: undefined,
				duration: undefined,
				notes: data.notes || undefined,
				attendanceType: data.attendanceType,
			} as Attendance & { id: string };
		} catch (error) {
			console.error("Error getting active work attendance:", error);
			throw error;
		}
	},

	getRecentAttendances: async (
		userId: string,
		days: number = 7
	): Promise<(Attendance & { id: string })[]> => {
		try {
			const attendanceRef = collection(db, "attendance");

			// Calculate date range for recent attendances
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(endDate.getDate() - days);

			const q = query(
				attendanceRef,
				where("userId", "==", userId),
				where("timeInAt", ">=", Timestamp.fromDate(startDate)),
				where("timeInAt", "<=", Timestamp.fromDate(endDate)),
				orderBy("timeInAt", "desc"),
				limit(20) // Limit to 20 most recent attendances
			);

			const querySnapshot = await getDocs(q);
			const attendances: (Attendance & { id: string })[] = [];

			querySnapshot.forEach((docSnapshot) => {
				const data = docSnapshot.data();
				attendances.push({
					id: docSnapshot.id,
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt || undefined,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy || undefined,
					duration: data.duration || undefined,
					notes: data.notes || undefined,
					attendanceType: data.attendanceType,
				});
			});

			return attendances;
		} catch (error) {
			console.error("Error getting recent work attendances:", error);
			throw error;
		}
	},

	getBranchAttendances: async (
		branchId: string,
		dateRange?: DateRange
	): Promise<Attendance[]> => {
		try {
			const attendanceRef = collection(db, "attendance");

			// Base query: filter by branchId and order by timeInAt descending
			let q = query(
				attendanceRef,
				where("branchId", "==", branchId),
				orderBy("timeInAt", "desc")
			);

			// Apply date range filter if provided
			if (dateRange) {
				q = query(
					attendanceRef,
					where("branchId", "==", branchId),
					where("timeInAt", ">=", dateRange.startDate),
					where("timeInAt", "<=", dateRange.endDate),
					orderBy("timeInAt", "desc")
				);
			}

			const querySnapshot = await getDocs(q);
			const attendances: Attendance[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				attendances.push({
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt || undefined,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy || undefined,
					duration: data.duration || undefined,
					notes: data.notes || undefined,
					attendanceType: data.attendanceType,
				});
			});

			return attendances;
		} catch (error) {
			console.error("Error getting branch work attendances:", error);
			throw error;
		}
	},

	calculateAttendanceDuration: (
		timeInAt: Timestamp,
		timeOutAt?: Timestamp
	): number => {
		if (!timeOutAt) {
			// If no timeout, calculate duration from time in to now
			const now = Timestamp.now();
			return Math.floor((now.seconds - timeInAt.seconds) / 60); // Duration in minutes
		}

		return Math.floor((timeOutAt.seconds - timeInAt.seconds) / 60); // Duration in minutes
	},

	getAttendancesByDateRange: async (
		userId: string,
		startDate: Date,
		endDate: Date
	): Promise<Attendance[]> => {
		try {
			const dateRange: DateRange = {
				startDate: Timestamp.fromDate(startDate),
				endDate: Timestamp.fromDate(endDate),
			};

			return await attendanceService.listAttendances(userId, dateRange);
		} catch (error) {
			console.error("Error getting attendances by date range:", error);
			throw error;
		}
	},

	// Time In/Out Operations
	timeInWorker: async (
		userId: string,
		branchId: string,
		notes?: string
	): Promise<string> => {
		try {
			// Create new work attendance
			const attendanceData: Attendance = {
				userId,
				branchId,
				timeInAt: Timestamp.now(),
				clockedInBy: userId, // In a real scenario, this would be the manager's ID
				notes: notes || "",
				attendanceType: "scheduled",
			};

			const attendanceId = await attendanceService.createAttendance(attendanceData);

			// Update user's current status in users collection
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				currentStatus: "clocked_in",
				currentBranchId: branchId,
				lastTimeIn: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});

			return attendanceId;
		} catch (error) {
			console.error("Error timing in worker:", error);
			throw error;
		}
	},

	timeOutWorker: async (
		userId: string,
		attendanceId: string,
		notes?: string
	): Promise<void> => {
		try {
			const timeOutAt = Timestamp.now();

			// Get the existing attendance to calculate duration
			const attendance = await attendanceService.getAttendance(attendanceId);
			if (!attendance) {
				throw new Error("Work attendance not found");
			}

			const duration = attendanceService.calculateAttendanceDuration(
				attendance.timeInAt,
				timeOutAt
			);

			// Update work attendance with time out data
			await attendanceService.updateAttendance(attendanceId, {
				timeOutAt,
				clockedOutBy: userId, // In a real scenario, this would be the manager's ID
				duration,
				notes: notes || attendance.notes || "",
			});

			// Update user's current status in users collection
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
};