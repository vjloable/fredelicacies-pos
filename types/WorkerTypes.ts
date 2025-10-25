import { Timestamp } from "firebase/firestore";

export type UserRole = "owner" | "manager" | "worker";
export interface CreateWorkerRequest {
	name: string;
	email: string;
	password: string;
	phoneNumber?: string;
	employeeId?: string;
	branchAssignments: Array<{
		branchId: string;
		role: "manager" | "worker";
	}>;
	isOwner?: boolean; // Only available to owner users
	profilePicture?: File;
}

export interface WorkerFilters {
	branchId?: string;
	role?: UserRole;
	status?: "clocked_in" | "clocked_out";
	searchQuery?: string;
	page?: number;
	limit?: number;
	excludeOwners?: boolean; // For managers who shouldn't see owners
}

export interface WorkSession {
	userId: string;
	branchId: string;
	timeInAt: Timestamp;
	timeOutAt?: Timestamp;
	clockedInBy: string;
	clockedOutBy?: string;
	duration?: number;
	notes?: string;
	sessionType: "scheduled" | "emergency" | "overtime";
}

export interface DateRange {
	startDate: Timestamp;
	endDate: Timestamp;
}

export interface WorkerStats {
	userId: string;
	totalHoursWorked: number;
	totalAttendances: number;
	averageAttendanceDuration: number; // in minutes
	currentStreak: number; // consecutive days worked
	longestStreak: number; // longest consecutive days worked
	thisWeek: {
		hoursWorked: number;
		attendancesCount: number;
		daysWorked: number;
	};
	thisMonth: {
		hoursWorked: number;
		attendancesCount: number;
		daysWorked: number;
	};
	lastAttendance?: {
		timeInAt: Timestamp;
		timeOutAt?: Timestamp;
		branchId: string;
		duration?: number;
	};
	branchStats: Array<{
		branchId: string;
		hoursWorked: number;
		attendancesCount: number;
		lastWorked?: Timestamp;
	}>;
	overtime: {
		thisWeek: number; // overtime hours this week
		thisMonth: number; // overtime hours this month
		total: number; // total overtime hours
	};
	attendance: {
		punctualityScore: number; // percentage of on-time clock-ins
		averageClockInDelay: number; // minutes late on average
		missedShifts: number; // scheduled but didn't show up
	};
}
