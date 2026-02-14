"use client";

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workerService, Worker } from "@/services/workerService";
import { Attendance, attendanceService } from "@/services/attendanceService";
import { dataStore } from "@/stores/dataStore";

interface TimeTrackingOptions {
	autoRefresh?: boolean;
	refreshInterval?: number;
}

interface TimeTrackingState {
	worker: Worker | null;
	isWorking: boolean;
	currentAttendance: any | null;
	workingDuration: number; // in minutes
	loading: boolean;
	error: string | null;
}

interface TimeTrackingActions {
	clockIn: (branchId: string, notes?: string) => Promise<void>;
	clockOut: (notes?: string) => Promise<void>;
	refreshStatus: () => Promise<void>;
	clearError: () => void;
}

interface TimeTrackingContextType
	extends TimeTrackingState,
		TimeTrackingActions {}

const TimeTrackingContext = createContext<TimeTrackingContextType | undefined>(
	undefined
);

export function useTimeTracking(
	options: TimeTrackingOptions = {}
): TimeTrackingContextType {
	const context = useContext(TimeTrackingContext);
	if (context === undefined) {
		throw new Error(
			"useTimeTracking must be used within a TimeTrackingProvider"
		);
	}
	return context;
}

interface TimeTrackingProviderProps {
	children: React.ReactNode;
	options?: TimeTrackingOptions;
}

export function TimeTrackingProvider({
	children,
	options = {},
}: TimeTrackingProviderProps) {
	const { user } = useAuth();
	const { autoRefresh = false, refreshInterval = 30000 } = options;

	const [state, setState] = useState<TimeTrackingState>({
		worker: null,
		isWorking: false,
		currentAttendance: null,
		workingDuration: 0,
		loading: true,
		error: null,
	});

	// Calculate working duration
	const calculateDuration = useCallback((attendance: Attendance): number => {
		if (!attendance || !attendance.clock_in) return 0;

		const startTime = new Date(attendance.clock_in);
		const now = new Date();
		return Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
	}, []);

	// Worker data subscription using dataStore
	useEffect(() => {
		if (!user) {
			setState((prev) => ({
				...prev,
				worker: null,
				isWorking: false,
				currentAttendance: null,
				workingDuration: 0,
				loading: false,
			}));
			return;
		}

		setState((prev) => ({ ...prev, loading: true, error: null }));

		dataStore.startWorkerListeners(user.uid);

		const handleWorkerUpdate = async (workerData: Worker | null) => {
			try {
				if (!workerData) {
					setState((prev) => ({
						...prev,
						worker: null,
						isWorking: false,
						currentAttendance: null,
						workingDuration: 0,
						loading: false,
					}));
					return;
				}

				const isWorking = workerData.currentStatus === "clocked_in";
				let currentAttendance = null;
				let workingDuration = 0;

				// Owners don't need time tracking since they're not assigned to branches
				const needsTimeTracking = !workerData.isOwner;

				if (isWorking && needsTimeTracking) {
					try {
						const result = await attendanceService.getActiveAttendance(
							user.uid
						);
						if (result.attendance && !result.error) {
							currentAttendance = result.attendance;
							workingDuration = calculateDuration(result.attendance);
						}
					} catch (attendanceError) {
						console.warn("Could not fetch active attendance:", attendanceError);
						// Don't set error state for attendance fetch failures
						// as this might be normal (no active attendance)
					}
				}

				console.log("TimeTracking Update:", {
					userId: user.uid,
					workerName: workerData.name,
					isWorking,
					hasAttendance: !!currentAttendance,
					workingDuration,
				});
				
				setState({
					worker: workerData,
					isWorking,
					currentAttendance,
					workingDuration,
					loading: false,
					error: null,
				});
			} catch (err: any) {
				console.error("Error processing worker data:", err);
				setState((prev) => ({
					...prev,
					loading: false,
					error: err.message || "Failed to process worker data",
				}));
			}
	};

	dataStore.subscribe(`workerChanged:${user.uid}`, handleWorkerUpdate);

	return () => {
		dataStore.unsubscribe(`workerChanged:${user.uid}`, handleWorkerUpdate);
		dataStore.stopWorkerListeners(user.uid);
	};
}, [user, calculateDuration]);

// Manual refresh function (now just triggers a re-fetch of current session)
const refreshStatus = useCallback(async () => {
		if (!user || !state.worker || !state.isWorking) return;

		try {
			const result = await attendanceService.getActiveAttendance(
				user.uid
			);
			if (result.attendance && !result.error) {
				const workingDuration = calculateDuration(result.attendance);
				setState((prev) => ({
					...prev,
					currentAttendance: result.attendance,
					workingDuration,
				}));
			}
		} catch (err: any) {
			console.warn("Could not refresh current attendance:", err);
		}
	}, [user, state.worker, state.isWorking, calculateDuration]);

	// Clock in
	const clockIn = useCallback(
		async (branchId: string, notes?: string) => {
			if (!user || !state.worker) {
				throw new Error("Unable to clock in");
			}

			// Owners don't use time tracking
			if (state.worker.isOwner) {
				throw new Error(
					"Owners don't need to clock in - you have global access"
				);
			}

			try {
				setState((prev) => ({ ...prev, loading: true, error: null }));

				const result = await attendanceService.clockIn(
					branchId,
					user.uid
				);

				if (result.error) {
					throw new Error(result.error.message || "Failed to clock in");
				}

				// Status will be updated automatically via dataStore subscription
			} catch (err: any) {
				const errorMessage = err.message || "Failed to clock in";
				setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
				throw new Error(errorMessage);
			}
		},
		[user, state.worker]
	);

	// Clock out
	const clockOut = useCallback(
		async (notes?: string) => {
			if (!user) {
				throw new Error("Unable to clock out - no user logged in");
			}
			if (!state.worker) {
				throw new Error("Unable to clock out - no worker data");
			}
			if (!state.currentAttendance) {
				throw new Error("Unable to clock out - no active attendance");
			}
			try {
				setState((prev) => ({ ...prev, loading: true, error: null }));

				const result = await attendanceService.clockOut(
					state.currentAttendance.id
				);

				if (result.error) {
					throw new Error(result.error.message || "Failed to clock out");
				}

				// Status will be updated automatically via dataStore subscription
			} catch (err: any) {
				const errorMessage = err.message || "Failed to clock out";
				setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
				throw new Error(errorMessage);
			}
		},
		[user, state.worker, state.currentAttendance]
	);

	// Clear error
	const clearError = useCallback(() => {
		setState((prev) => ({ ...prev, error: null }));
	}, []);

	// Auto refresh
	useEffect(() => {
		if (!autoRefresh || !state.isWorking) return;

		const interval = setInterval(() => {
			// Update working duration without full refresh when working
			if (state.currentAttendance) {
				setState((prev) => ({
					...prev,
					workingDuration: calculateDuration(state.currentAttendance),
				}));
			}

			// Occasionally refresh attendance data for accuracy (every 5 minutes)
			if (Math.random() < 0.03) { // Reduced from 0.1 to 0.03 (3% chance instead of 10%)
				refreshStatus();
			}
		}, Math.max(refreshInterval, 60000)); // Ensure minimum 1 minute intervals

		return () => clearInterval(interval);
	}, [
		autoRefresh,
		refreshInterval,
		state.isWorking,
		state.currentAttendance,
		calculateDuration,
		refreshStatus,
	]);

	const value: TimeTrackingContextType = {
		...state,
		clockIn,
		clockOut,
		refreshStatus,
		clearError,
	};

	return (
		<TimeTrackingContext.Provider value={value}>
			{children}
		</TimeTrackingContext.Provider>
	);
}

// Helper hook for checking POS access based on time tracking
export function usePOSAccessControl(branchId?: string) {
	const { user } = useAuth();
	const timeTracking = useTimeTracking();

	const canAccessPOS = useCallback(() => {
		if (!user || !timeTracking.worker) return false;

		// Owners always have full access to POS (no time tracking required)
		if (timeTracking.worker.isOwner) return true;

		// Non-admin users must be clocked in to access POS
		if (!timeTracking.isWorking) return false;

		// Check branch access if specified
		if (branchId) {
			const hasAccessToBranch = timeTracking.worker.roleAssignments.some(
				(assignment) => assignment.branchId === branchId && assignment.isActive
			);
			return hasAccessToBranch;
		}

		return true;
	}, [user, timeTracking.worker, timeTracking.isWorking, branchId]);

	const accessMessage = useCallback(() => {
		if (!user || !timeTracking.worker) {
			return "Please log in to access the POS system";
		}

		// Owners have no access restrictions
		if (timeTracking.worker.isOwner) {
			return null;
		}

		if (!timeTracking.isWorking) {
			return "Please clock in to access the POS system";
		}

		if (branchId) {
			const hasAccessToBranch = timeTracking.worker.roleAssignments.some(
				(assignment) => assignment.branchId === branchId && assignment.isActive
			);
			if (!hasAccessToBranch) {
				return "You don't have access to this branch location";
			}
		}

		return null;
	}, [user, timeTracking.worker, timeTracking.isWorking, branchId]);

	return {
		canAccessPOS: canAccessPOS(),
		accessMessage: accessMessage(),
		timeTracking,
	};
}
