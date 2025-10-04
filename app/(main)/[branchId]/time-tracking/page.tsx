"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { workSessionService } from "@/services/workSessionService";
import { branchService, Branch } from "@/services/branchService";
import TopBar from "@/components/TopBar";
import ClockIcon from "@/components/icons/ClockIcon";
import QuickTimeWidget from "@/components/QuickTimeWidget";

interface RecentSession {
	id: string;
	timeInAt: any;
	timeOutAt?: any;
	branchId: string;
	duration?: number;
	notes?: string;
}

export default function TimeTrackingPage() {
	const { user } = useAuth();
	const { currentBranch } = useBranch();
	const timeTracking = useTimeTracking({
		autoRefresh: true,
		refreshInterval: 10000,
	});

	const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
	const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
	const [selectedBranchId, setSelectedBranchId] = useState<string>("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (user && timeTracking.worker) {
			loadRecentSessions();
			loadAvailableBranches();
		}
	}, [user, timeTracking.worker]);

	useEffect(() => {
		if (currentBranch) {
			setSelectedBranchId(currentBranch.id);
		}
	}, [currentBranch]);

	const loadRecentSessions = async () => {
		if (!user) return;

		try {
			// For now, just set empty array since we need to fix service method
			setRecentSessions([]);
		} catch (err: any) {
			console.error("Error loading recent sessions:", err);
		}
	};

	const loadAvailableBranches = async () => {
		if (!timeTracking.worker) return;

		try {
			const branchPromises = timeTracking.worker.roleAssignments
				.filter((assignment) => assignment.isActive)
				.map((assignment) => branchService.getBranchById(assignment.branchId));

			const branches = await Promise.all(branchPromises);
			setAvailableBranches(branches.filter((b): b is Branch => b !== null));
		} catch (err: any) {
			console.error("Error loading available branches:", err);
		}
	};

	const handleQuickClockIn = async () => {
		if (!selectedBranchId) {
			alert("Please select a branch to clock in");
			return;
		}

		setLoading(true);
		try {
			await timeTracking.clockIn(
				selectedBranchId,
				`Clock-in from Time Management page - ${new Date().toLocaleString()}`
			);
			await loadRecentSessions();
		} catch (err: any) {
			alert(err.message || "Failed to clock in");
		} finally {
			setLoading(false);
		}
	};

	const handleQuickClockOut = async () => {
		setLoading(true);
		try {
			await timeTracking.clockOut(
				`Clock-out from Time Management page - ${new Date().toLocaleString()}`
			);
			await loadRecentSessions();
		} catch (err: any) {
			alert(err.message || "Failed to clock out");
		} finally {
			setLoading(false);
		}
	};

	const formatDuration = (minutes: number): string => {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
	};

	const formatSessionDuration = (session: RecentSession): string => {
		if (session.duration) {
			return formatDuration(session.duration);
		}

		if (session.timeInAt && session.timeOutAt) {
			const startTime = session.timeInAt.toDate
				? session.timeInAt.toDate()
				: session.timeInAt;
			const endTime = session.timeOutAt.toDate
				? session.timeOutAt.toDate()
				: session.timeOutAt;
			const diffMs = endTime.getTime() - startTime.getTime();
			const diffMins = Math.floor(diffMs / (1000 * 60));
			return formatDuration(diffMins);
		}

		return "In progress";
	};

	const getBranchName = (branchId: string): string => {
		const branch = availableBranches.find((b) => b.id === branchId);
		return branch ? branch.name : branchId;
	};

	// Don't show for admin users
	if (!user || !timeTracking.worker || timeTracking.worker.isAdmin) {
		return (
			<div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
				<div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center'>
					<div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
						<ClockIcon className='w-8 h-8 text-blue-600' />
					</div>
					<h3 className='text-lg font-semibold text-gray-900 mb-2'>
						Time Tracking Not Available
					</h3>
					<p className='text-gray-600 text-sm'>
						{!user
							? "Please log in to access time tracking"
							: "Admin users are not subject to time tracking"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gray-50'>
			<TopBar title='Time Tracking' icon={<ClockIcon />} />

			<div className='max-w-4xl mx-auto p-6 space-y-6'>
				{/* Time Tracking Error */}
				{timeTracking.error && (
					<div className='bg-red-50 border border-red-200 rounded-lg p-4'>
						<div className='flex items-center'>
							<svg
								className='w-5 h-5 text-red-400 mr-3'
								fill='currentColor'
								viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clipRule='evenodd'
								/>
							</svg>
							<div>
								<h3 className='text-sm font-medium text-red-800'>
									Time Tracking Error
								</h3>
								<p className='text-sm text-red-700 mt-1'>
									{timeTracking.error}
								</p>
							</div>
							<button
								onClick={timeTracking.clearError}
								className='ml-auto text-red-400 hover:text-red-600'>
								<svg
									className='w-5 h-5'
									fill='currentColor'
									viewBox='0 0 20 20'>
									<path
										fillRule='evenodd'
										d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
										clipRule='evenodd'
									/>
								</svg>
							</button>
						</div>
					</div>
				)}

				{/* Current Status Card */}
				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					<div className='lg:col-span-2'>
						<div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
							<div className='flex items-center justify-between mb-6'>
								<h2 className='text-xl font-semibold text-gray-900'>
									Current Status
								</h2>
								<div
									className={`w-3 h-3 rounded-full ${
										timeTracking.isWorking
											? "bg-green-400 animate-pulse"
											: "bg-gray-300"
									}`}></div>
							</div>

							<div className='grid grid-cols-2 gap-6'>
								{/* Status Info */}
								<div className='space-y-4'>
									<div>
										<span className='text-sm text-gray-600'>Status:</span>
										<div
											className={`inline-flex items-center mt-1 px-3 py-1 rounded-full text-sm font-medium ${
												timeTracking.isWorking
													? "bg-green-100 text-green-800"
													: "bg-gray-100 text-gray-800"
											}`}>
											<div
												className={`w-2 h-2 rounded-full mr-2 ${
													timeTracking.isWorking
														? "bg-green-400"
														: "bg-gray-400"
												}`}
											/>
											{timeTracking.isWorking ? "Clocked In" : "Clocked Out"}
										</div>
									</div>

									{timeTracking.isWorking && timeTracking.currentSession && (
										<>
											<div>
												<span className='text-sm text-gray-600'>
													Started at:
												</span>
												<div className='text-lg font-semibold text-gray-900'>
													{new Date(
														timeTracking.currentSession.timeInAt.toDate
															? timeTracking.currentSession.timeInAt.toDate()
															: timeTracking.currentSession.timeInAt
													).toLocaleTimeString()}
												</div>
											</div>
											<div>
												<span className='text-sm text-gray-600'>
													Working for:
												</span>
												<div className='text-lg font-semibold text-blue-600'>
													{formatDuration(timeTracking.workingDuration)}
												</div>
											</div>
											<div>
												<span className='text-sm text-gray-600'>Location:</span>
												<div className='text-sm text-gray-900'>
													{getBranchName(timeTracking.currentSession.branchId)}
												</div>
											</div>
										</>
									)}
								</div>

								{/* Quick Actions */}
								<div className='space-y-4'>
									{!timeTracking.isWorking ? (
										<>
											<div>
												<label className='text-sm text-gray-600'>
													Select Branch:
												</label>
												<select
													value={selectedBranchId}
													onChange={(e) => setSelectedBranchId(e.target.value)}
													className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'>
													<option value=''>Select a branch...</option>
													{availableBranches.map((branch) => (
														<option key={branch.id} value={branch.id}>
															{branch.name}
														</option>
													))}
												</select>
											</div>
											<button
												onClick={handleQuickClockIn}
												disabled={loading || !selectedBranchId}
												className='w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'>
												{loading ? (
													<div className='flex items-center'>
														<div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
														Clocking In...
													</div>
												) : (
													<>
														<ClockIcon className='w-4 h-4 mr-2' />
														Clock In
													</>
												)}
											</button>
										</>
									) : (
										<button
											onClick={handleQuickClockOut}
											disabled={loading}
											className='w-full flex items-center justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'>
											{loading ? (
												<div className='flex items-center'>
													<div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
													Clocking Out...
												</div>
											) : (
												<>
													<ClockIcon className='w-4 h-4 mr-2' />
													Clock Out
												</>
											)}
										</button>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Quick Time Widget */}
					<div className='lg:col-span-1'>
						<QuickTimeWidget
							currentBranchId={selectedBranchId || currentBranch?.id}
							className='h-full'
						/>
					</div>
				</div>

				{/* Recent Sessions */}
				<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
					<div className='px-6 py-4 border-b border-gray-200'>
						<div className='flex items-center justify-between'>
							<h3 className='text-lg font-semibold text-gray-900'>
								Recent Sessions
							</h3>
							<span className='text-sm text-gray-500'>Last 7 days</span>
						</div>
					</div>

					<div className='p-6'>
						{recentSessions.length === 0 ? (
							<div className='text-center py-8'>
								<div className='w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
									<ClockIcon className='w-6 h-6 text-gray-400' />
								</div>
								<p className='text-gray-600'>No recent sessions found</p>
								<p className='text-gray-500 text-sm mt-1'>
									Your work sessions will appear here
								</p>
							</div>
						) : (
							<div className='space-y-4'>
								{recentSessions.slice(0, 10).map((session, index) => (
									<div
										key={session.id || index}
										className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
										<div className='flex items-center space-x-4'>
											<div
												className={`w-10 h-10 rounded-full flex items-center justify-center ${
													session.timeOutAt ? "bg-blue-100" : "bg-green-100"
												}`}>
												<ClockIcon
													className={`w-5 h-5 ${
														session.timeOutAt
															? "text-blue-600"
															: "text-green-600"
													}`}
												/>
											</div>
											<div>
												<div className='font-medium text-gray-900'>
													{getBranchName(session.branchId)}
												</div>
												<div className='text-sm text-gray-600'>
													{new Date(
														session.timeInAt.toDate
															? session.timeInAt.toDate()
															: session.timeInAt
													).toLocaleDateString()}{" "}
													•{" "}
													{new Date(
														session.timeInAt.toDate
															? session.timeInAt.toDate()
															: session.timeInAt
													).toLocaleTimeString()}
													{session.timeOutAt && (
														<>
															{" "}
															-{" "}
															{new Date(
																session.timeOutAt.toDate
																	? session.timeOutAt.toDate()
																	: session.timeOutAt
															).toLocaleTimeString()}
														</>
													)}
												</div>
												{session.notes && (
													<div className='text-xs text-gray-500 mt-1'>
														{session.notes}
													</div>
												)}
											</div>
										</div>
										<div className='text-right'>
											<div className='font-semibold text-gray-900'>
												{formatSessionDuration(session)}
											</div>
											<div
												className={`text-xs ${
													session.timeOutAt
														? "text-gray-500"
														: "text-green-600 font-medium"
												}`}>
												{session.timeOutAt ? "Completed" : "Active"}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
