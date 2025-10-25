import React, { useState, useEffect } from "react";
import { Worker } from "@/services/workerService";
import { attendanceService, Attendance } from "@/services/attendanceService";
import { useAccessibleBranches } from "@/contexts/BranchContext";
import { Timestamp } from "firebase/firestore";

interface WorkerPerformanceProps {
	worker: Worker;
	dateRange?: {
		startDate: Date;
		endDate: Date;
	};
}

interface PerformanceMetrics {
	totalHours: number;
	averageSessionLength: number;
	punctualityScore: number;
	productivityTrend: "up" | "down" | "stable";
	branchPerformance: Array<{
		branchId: string;
		branchName: string;
		hours: number;
		attendances: number;
		lastWorked: Date | null;
	}>;
	weeklyBreakdown: Array<{
		week: string;
		hours: number;
		attendances: number;
	}>;
	dailyPattern: Array<{
		day: string;
		averageHours: number;
		attendancesCount: number;
	}>;
}

export default function WorkerPerformanceAnalytics({
	worker,
	dateRange,
}: WorkerPerformanceProps) {
	const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const { allBranches } = useAccessibleBranches();

	useEffect(() => {
		loadPerformanceMetrics();
	}, [worker.id, dateRange]);

	const loadPerformanceMetrics = async () => {
		try {
			setLoading(true);
			setError(null);

			// Get work sessions for the worker
			const sessions =
				(await attendanceService.listAttendances(
					worker.id,
					dateRange
						? {
								startDate: Timestamp.fromDate(dateRange.startDate),
								endDate: Timestamp.fromDate(dateRange.endDate),
						  }
						: undefined
				)) || [];

			// Calculate performance metrics
			const calculatedMetrics = calculatePerformanceMetrics(sessions);
			setMetrics(calculatedMetrics);
		} catch (err: unknown) {
			console.error("Error loading performance metrics:", err);
			setError(err instanceof Error ? err.message : "Failed to load performance data");
		} finally {
			setLoading(false);
		}
	};

	const calculatePerformanceMetrics = (attendances: Attendance[]): PerformanceMetrics => {
		// Basic calculations
		const totalHours = attendances.reduce((sum, attendance) => {
			if (attendance.duration) {
				return sum + attendance.duration / 60; // Convert minutes to hours
			}
			if (attendance.timeInAt && attendance.timeOutAt) {
				const startTime = attendance.timeInAt instanceof Timestamp
					? attendance.timeInAt.toDate()
					: attendance.timeInAt;
				const endTime = attendance.timeOutAt instanceof Timestamp
					? attendance.timeOutAt.toDate()
					: attendance.timeOutAt;
				return (
					sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
				);
			}
			return sum;
		}, 0);

		const averageSessionLength =
			attendances.length > 0 ? totalHours / attendances.length : 0;

		// Punctuality calculation (simplified - based on start times)
		const punctualityScore = calculatePunctualityScore(attendances);

		// Productivity trend (simplified)
		const productivityTrend = calculateProductivityTrend(attendances);

		// Branch performance
		const branchPerformance = calculateBranchPerformance(attendances);

		// Weekly breakdown
		const weeklyBreakdown = calculateWeeklyBreakdown(attendances);

		// Daily pattern
		const dailyPattern = calculateDailyPattern(attendances);

		return {
			totalHours,
			averageSessionLength,
			punctualityScore,
			productivityTrend,
			branchPerformance,
			weeklyBreakdown,
			dailyPattern,
		};
	};

	const calculatePunctualityScore = (attendances: Attendance[]): number => {
		// Simplified punctuality: assume on-time if clocked in within 15 minutes of hour
		const punctualAttendances = attendances.filter((attendance) => {
			if (!attendance.timeInAt) return false;

			const startTime = attendance.timeInAt instanceof Timestamp
				? attendance.timeInAt.toDate()
				: attendance.timeInAt;
			const minutes = startTime.getMinutes();

			// Consider on-time if within 15 minutes of the hour
			return minutes <= 15 || minutes >= 45;
		});

		return attendances.length > 0
			? Math.round((punctualAttendances.length / attendances.length) * 100)
			: 0;
	};

	const calculateProductivityTrend = (
		attendances: Attendance[]
	): "up" | "down" | "stable" => {
		if (attendances.length < 4) return "stable";

		// Compare first half vs second half of attendances
		const midpoint = Math.floor(attendances.length / 2);
		const firstHalf = attendances.slice(0, midpoint);
		const secondHalf = attendances.slice(midpoint);

		const firstHalfAvg =
			firstHalf.reduce((sum, attendance) => {
				return sum + (attendance.duration || 0);
			}, 0) / firstHalf.length;

		const secondHalfAvg =
			secondHalf.reduce((sum, attendance) => {
				return sum + (attendance.duration || 0);
			}, 0) / secondHalf.length;

		const difference = secondHalfAvg - firstHalfAvg;
		const threshold = 30; // 30 minutes threshold

		if (difference > threshold) return "up";
		if (difference < -threshold) return "down";
		return "stable";
	};

	const calculateBranchPerformance = (attendances: Attendance[]) => {
		const branchMap = new Map();

		attendances.forEach((attendance) => {
			if (!branchMap.has(attendance.branchId)) {
				branchMap.set(attendance.branchId, {
					branchId: attendance.branchId,
					branchName: getBranchName(attendance.branchId),
					hours: 0,
					attendances: 0,
					lastWorked: null,
				});
			}

			const branch = branchMap.get(attendance.branchId);
			branch.sessions++;

			if (attendance.duration) {
				branch.hours += attendance.duration / 60;
			}

			const sessionDate = attendance.timeInAt.toDate
				? attendance.timeInAt.toDate()
				: attendance.timeInAt;
			if (!branch.lastWorked || sessionDate > branch.lastWorked) {
				branch.lastWorked = sessionDate;
			}
		});

		return Array.from(branchMap.values());
	};

	const calculateWeeklyBreakdown = (attendances: Attendance[]) => {
		const weekMap = new Map();

		attendances.forEach((attendance) => {
			const attendanceDate = attendance.timeInAt instanceof Timestamp
				? attendance.timeInAt.toDate()
				: attendance.timeInAt;
			const weekStart = getWeekStart(attendanceDate);
			const weekKey = weekStart.toISOString().split("T")[0];

			if (!weekMap.has(weekKey)) {
				weekMap.set(weekKey, {
					week: formatWeek(weekStart),
					hours: 0,
					attendances: 0,
				});
			}

			const week = weekMap.get(weekKey);
			week.attendances++;

			if (attendance.duration) {
				week.hours += attendance.duration / 60;
			}
		});

		return Array.from(weekMap.values()).sort((a, b) =>
			a.week.localeCompare(b.week)
		);
	};

	const calculateDailyPattern = (attendances: Attendance[]) => {
		const dayMap = new Map();
		const dayNames = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];

		dayNames.forEach((day) => {
			dayMap.set(day, {
				day,
				averageHours: 0,
				sessionsCount: 0,
			});
		});

		attendances.forEach((attendance) => {
			const attendanceDate = attendance.timeInAt instanceof Timestamp
				? attendance.timeInAt.toDate()
				: attendance.timeInAt;
			const dayName = dayNames[attendanceDate.getDay()];

			const dayData = dayMap.get(dayName);
			dayData.attendances++;

			if (attendance.duration) {
				dayData.averageHours += attendance.duration / 60;
			}
		});

		// Calculate averages
		dayMap.forEach((dayData) => {
			if (dayData.attendancesCount > 0) {
				dayData.averageHours = dayData.averageHours / dayData.attendancesCount;
			}
		});

		return Array.from(dayMap.values());
	};

	const getBranchName = (branchId: string): string => {
		const branch = allBranches.find((b) => b.id === branchId);
		return branch ? branch.name : branchId;
	};

	const getWeekStart = (date: Date): Date => {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day;
		return new Date(d.setDate(diff));
	};

	const formatWeek = (weekStart: Date): string => {
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 6);
		return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
	};

	const formatHours = (hours: number): string => {
		const wholeHours = Math.floor(hours);
		const minutes = Math.round((hours - wholeHours) * 60);
		return wholeHours > 0 ? `${wholeHours}h ${minutes}m` : `${minutes}m`;
	};

	const getTrendIcon = (trend: string) => {
		switch (trend) {
			case "up":
				return <span className='text-green-600'>↗️ Improving</span>;
			case "down":
				return <span className='text-red-600'>↘️ Declining</span>;
			default:
				return <span className='text-gray-600'>→ Stable</span>;
		}
	};

	if (loading) {
		return (
			<div className='bg-white rounded-lg shadow p-6'>
				<h3 className='text-lg font-semibold text-gray-900 mb-4'>
					Performance Analytics
				</h3>
				<div className='space-y-4'>
					{[...Array(4)].map((_, i) => (
						<div key={i} className='animate-pulse'>
							<div className='bg-gray-100 rounded-lg p-4'>
								<div className='h-4 bg-gray-300 rounded mb-2'></div>
								<div className='h-8 bg-gray-300 rounded'></div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='bg-white rounded-lg shadow p-6'>
				<h3 className='text-lg font-semibold text-gray-900 mb-4'>
					Performance Analytics
				</h3>
				<div className='text-center py-8'>
					<div className='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4'>
						<svg
							className='w-6 h-6 text-red-600'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
					</div>
					<p className='text-gray-600 text-sm'>{error}</p>
					<button
						onClick={loadPerformanceMetrics}
						className='mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium'>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!metrics) {
		return null;
	}

	return (
		<div className='bg-white rounded-lg shadow'>
			<div className='p-6 border-b border-gray-200'>
				<h3 className='text-lg font-semibold text-gray-900'>
					Performance Analytics
				</h3>
				<p className='text-sm text-gray-600 mt-1'>
					Detailed performance insights for {worker.name}
				</p>
			</div>

			<div className='p-6 space-y-8'>
				{/* Key Metrics */}
				<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
					<div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
						<h4 className='text-sm font-medium text-blue-800'>Total Hours</h4>
						<p className='text-2xl font-bold text-blue-900'>
							{formatHours(metrics.totalHours)}
						</p>
					</div>
					<div className='bg-green-50 border border-green-200 rounded-lg p-4'>
						<h4 className='text-sm font-medium text-green-800'>Avg Session</h4>
						<p className='text-2xl font-bold text-green-900'>
							{formatHours(metrics.averageSessionLength)}
						</p>
					</div>
					<div className='bg-purple-50 border border-purple-200 rounded-lg p-4'>
						<h4 className='text-sm font-medium text-purple-800'>Punctuality</h4>
						<p className='text-2xl font-bold text-purple-900'>
							{metrics.punctualityScore}%
						</p>
					</div>
					<div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
						<h4 className='text-sm font-medium text-yellow-800'>Trend</h4>
						<p className='text-lg font-semibold'>
							{getTrendIcon(metrics.productivityTrend)}
						</p>
					</div>
				</div>

				{/* Branch Performance */}
				{metrics.branchPerformance.length > 0 && (
					<div>
						<h4 className='font-semibold text-gray-900 mb-4'>
							Performance by Branch
						</h4>
						<div className='grid gap-3'>
							{metrics.branchPerformance.map((branch) => (
								<div
									key={branch.branchId}
									className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
									<div>
										<div className='font-medium text-gray-900'>
											{branch.branchName}
										</div>
										<div className='text-sm text-gray-600'>
											{branch.attendances} sessions • Last worked:{" "}
											{branch.lastWorked?.toLocaleDateString() || "Never"}
										</div>
									</div>
									<div className='text-right'>
										<div className='font-semibold text-gray-900'>
											{formatHours(branch.hours)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Weekly Breakdown */}
				{metrics.weeklyBreakdown.length > 0 && (
					<div>
						<h4 className='font-semibold text-gray-900 mb-4'>
							Weekly Breakdown
						</h4>
						<div className='space-y-2'>
							{metrics.weeklyBreakdown.slice(-4).map((week) => (
								<div
									key={week.week}
									className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
									<div>
										<div className='font-medium text-gray-900'>{week.week}</div>
										<div className='text-sm text-gray-600'>
											{week.attendances} sessions
										</div>
									</div>
									<div className='text-right'>
										<div className='font-semibold text-gray-900'>
											{formatHours(week.hours)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Daily Pattern */}
				<div>
					<h4 className='font-semibold text-gray-900 mb-4'>
						Daily Work Pattern
					</h4>
					<div className='grid grid-cols-7 gap-2'>
						{metrics.dailyPattern.map((day) => (
							<div
								key={day.day}
								className='text-center p-3 bg-gray-50 rounded-lg'>
								<div className='text-xs font-medium text-gray-600 mb-1'>
									{day.day.slice(0, 3)}
								</div>
								<div className='text-sm font-semibold text-gray-900'>
									{day.attendancesCount > 0 ? formatHours(day.averageHours) : "-"}
								</div>
								<div className='text-xs text-gray-500'>
									{day.attendancesCount} attendances
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
