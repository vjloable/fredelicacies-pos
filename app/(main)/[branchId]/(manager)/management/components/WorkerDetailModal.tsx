"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Worker } from "@/services/workerService";
import { attendanceService, Attendance } from "@/services/attendanceService";
import { branchService } from "@/services/branchService";

import LoadingSpinner from "../../../../../../components/LoadingSpinner";

interface AttendanceWithMetadata extends Attendance {
	id?: string;
	branchName?: string;
	totalMinutes?: number;
	status?: "active" | "completed";
}

interface WorkerDetailModalProps {
	worker: Worker | null;
	isOpen: boolean;
	onClose: () => void;
}

export default function WorkerDetailModal({
	worker,
	isOpen,
	onClose,
}: WorkerDetailModalProps) {
	const [attendances, setAttendances] = useState<AttendanceWithMetadata[]>(
		[]
	);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<"details" | "sessions">("details");
	const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
	const [dataLoaded, setDataLoaded] = useState(false);

	const loadBranchNames = useCallback(async () => {
		if (!worker) return;

		try {
			// Get unique branch IDs from role assignments
			const branchIds = Array.from(
				new Set(worker.roleAssignments.map(assignment => assignment.branchId))
			);

			// Fetch branch names
			const branchNameMap = new Map<string, string>();
			
			for (const branchId of branchIds) {
				const branch = await branchService.getBranchById(branchId);
				if (branch) {
					branchNameMap.set(branchId, branch.name);
				} else {
					branchNameMap.set(branchId, `Branch ${branchId}`);
				}
			}

			setBranchMap(branchNameMap);
		} catch (error) {
			console.error("Error loading branch names:", error);
		}
	}, [worker]);

	const loadAttendances = useCallback(async (branchNames: Map<string, string>) => {
		if (!worker) return;

		try {
			setLoading(true);
			const attendances: Attendance[] = await attendanceService.getAttendancesByDateRange(
				worker.id,
				new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
				new Date()
			);

			// Process attendances to add metadata
			const processedAttendances = attendances.map((attendance, index) => ({
				...attendance,
				id: `session-${index}`,
				status: attendance.timeOutAt
					? "completed"
					: ("active" as "active" | "completed"),
				totalMinutes:
					attendance.duration ||
					(attendance.timeOutAt
						? attendanceService.calculateAttendanceDuration(
								attendance.timeInAt,
								attendance.timeOutAt
						  )
						: undefined),
				branchName: branchNames.get(attendance.branchId) || `Branch ${attendance.branchId}`,
			}));

			setAttendances(processedAttendances);
		} catch (error) {
			console.error("Error loading attendances:", error);
		} finally {
			setLoading(false);
		}
	}, [worker]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setAttendances([]);
			setBranchMap(new Map());
			setDataLoaded(false);
			setActiveTab("details");
			setLoading(false);
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen && worker && !dataLoaded) {
			const initializeData = async () => {
				try {
					// First load branch names
					await loadBranchNames();
					
					// Get the updated branch map after loading
					const branchIds = Array.from(
						new Set(worker.roleAssignments.map(assignment => assignment.branchId))
					);
					
					const branchNameMap = new Map<string, string>();
					for (const branchId of branchIds) {
						const branch = await branchService.getBranchById(branchId);
						if (branch) {
							branchNameMap.set(branchId, branch.name);
						} else {
							branchNameMap.set(branchId, `Branch ${branchId}`);
						}
					}
					
					// Then load attendances with the branch names
					await loadAttendances(branchNameMap);
					setDataLoaded(true);
				} catch (error) {
					console.error("Error initializing data:", error);
					setLoading(false);
				}
			};
			
			initializeData();
		}
	}, [isOpen, worker, dataLoaded, loadBranchNames, loadAttendances]);

	const formatDate = (date: Date) => {
		if (!date) return "N/A";
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	};

	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours}h ${mins}m`;
	};

	const getStatusBadge = (status: string) => {
		const baseClasses = "px-2 py-1 text-xs rounded-full font-medium";
		switch (status) {
			case "clocked_in":
				return `${baseClasses} bg-[var(--success)]/10 text-[var(--success)]`;
			case "clocked_out":
				return `${baseClasses} bg-[var(--error)]/10 text-[var(--error)]`;
			default:
				return `${baseClasses} bg-[var(--secondary)]/10 text-[var(--secondary)]`;
		}
	};

	if (!isOpen || !worker) return null;

	return (
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden'>
				{/* Header */}
				<div className='flex items-center justify-between p-6 border-b border-[var(--secondary)]/20'>
					<div className='flex items-center gap-4'>
						<div className='w-12 h-12 bg-[var(--secondary)]/10 rounded-full flex items-center justify-center'>
							<span className='text-[var(--secondary)] font-bold text-md'>
								{worker.name?.charAt(0) || worker.email.charAt(0)}
							</span>
						</div>
						<div>
							<h2 className='text-sm font-bold text-[var(--secondary)]'>
								{worker.name || "Unnamed Worker"}
							</h2>
							<p className='text-[var(--secondary)] text-sm'>{worker.email}</p>
						</div>
						{worker.isOwner && (
							<span className='bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 text-xs rounded-full font-medium'>
								Owner
							</span>
						)}
					</div>
					<button
						onClick={onClose}
						className='text-[var(--secondary)] hover:text-[var(--secondary)]/60 transition-colors'>
						<svg
							className='w-6 h-6'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				{/* Tab Navigation */}
				<div className='flex border-b border-gray-200'>
					<button
						onClick={() => setActiveTab("details")}
						className={`px-6 py-3 font-medium text-sm transition-colors ${
							activeTab === "details"
								? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
								: "text-[var(--secondary)] hover:text-[var(--secondary)]/60"
						}`}>
						Worker Details
					</button>
					<button
						onClick={() => setActiveTab("sessions")}
						className={`px-6 py-3 font-medium text-sm transition-colors ${
							activeTab === "sessions"
								? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
								: "text-[var(--secondary)] hover:text-[var(--secondary)]/60"
						}`}>
						Attendances<span className="ml-3 rounded-full px-2 py-1 bg-[var(--secondary)]/10 text-[var(--secondary)]/50 text-xs">Last 30 Days</span>
					</button>
				</div>

				{/* Content */}
				<div className='p-6 overflow-y-auto max-h-[60vh]'>
					{activeTab === "details" && (
						<div className='space-y-6'>
							{/* Basic Information */}
							<div className='grid grid-cols-1 md:grid-cols-1 gap-6'>
								<div className='space-y-4'>
									<h3 className='text-lg font-semibold text-[var(--secondary)]'>
										Basic Information
									</h3>
									<div className='space-y-2'>
										<div className='flex justify-between'>
											<span className='text-[var(--secondary)] text-sm'>Employee ID:</span>
											<span className='font-medium text-sm'>{worker.id}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-[var(--secondary)] text-sm'>Email:</span>
											<span className='font-medium text-sm'>{worker.email}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-[var(--secondary)] text-sm'>Phone:</span>
											<span className='font-medium text-sm'>Not provided</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-[var(--secondary)] text-sm'>Current Status:</span>
											<span
												className={getStatusBadge(
													worker.currentStatus || "clocked_out"
												)}>
												{worker.currentStatus === "clocked_in"
													? "Clocked In"
													: "Clocked Out"}
											</span>
										</div>
									</div>
								</div>

								<div className='space-y-4'>
									<h3 className='text-lg font-semibold text-[var(--secondary)]'>
										Employment Details
									</h3>
									<div className='space-y-2'>
										<div className='flex justify-between'>
											<span className='text-[var(--secondary)] text-sm'>Joined:</span>
											<span className='font-medium text-sm'>
												{formatDate(worker.createdAt)}
											</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-[var(--secondary)] text-sm'>Last Updated:</span>
											<span className='font-medium text-sm'>
												{formatDate(worker.updatedAt)}
											</span>
										</div>
									</div>
								</div>
							</div>

							{/* Role Assignments */}
							<div className='space-y-4'>
								<h3 className='text-lg font-semibold text-[var(--secondary)]'>
									Role Assignments
								</h3>
								{worker.roleAssignments && worker.roleAssignments.length > 0 ? (
									<div className='space-y-3'>
										{worker.roleAssignments.map((assignment, index) => (
											<div
												key={index}
												className='flex items-center justify-between p-4 bg-[var(--secondary)]/5 rounded-lg'>
												<div className='flex items-center gap-3'>
													<span className='font-medium'>
														{branchMap.get(assignment.branchId) || `Branch ${assignment.branchId}`}
													</span>
													<span className='rounded-full bg-[var(--accent)] text-[var(--primary)] text-xs px-3 py-1 font-bold '>
														{assignment.role.toUpperCase()}
													</span>
												</div>
												<div className='flex items-center gap-2'>
													<span
														className={`px-2 py-1 text-xs rounded-full font-medium ${
															assignment.isActive
																? "bg-[var(--success)]/10 text-[var(--success)]"
																: "bg-[var(--error)]/10 text-[var(--error)]"
														}`}>
														{assignment.isActive ? "Active" : "Inactive"}
													</span>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className='text-[var(--secondary)]/50 italic text-sm'>No role assignments</p>
								)}
							</div>
						</div>
					)}

					{activeTab === "sessions" && (
						<div className='space-y-4'>
							{loading ? (
								<div className='flex items-center justify-center py-8'>
									<LoadingSpinner size='lg' />
								</div>
							) : attendances.length > 0 ? (
								<div className='space-y-3'>
									{attendances.map((attendance) => (
										<div
											key={
												attendance.id || `${attendance.userId}-${attendance.timeInAt}`
											}
											className='flex items-center justify-between p-4 bg-[var(--secondary)]/5 rounded-lg'>
											<div className='space-y-1'>
												<div className='flex items-center gap-3'>
													<span className='font-medium'>
														{attendance.branchName || `Branch ${attendance.branchId}`}
													</span>
													<span
														className={`px-2 py-1 text-xs rounded-full font-medium ${
															attendance.status === "active"
																? "bg-[var(--success)]/80 text-[var(--primary)]"
																: "bg-[var(--secondary)]/10 text-[var(--secondary)]/80"
														}`}>
														{attendance.status === "active"
															? "In Progress"
															: "Completed"}
													</span>
												</div>
												<div className='text-sm text-gray-600'>
													<span className='font-medium'>Clock In:</span>{" "}
													{formatDate(attendance.timeInAt.toDate())}
													{attendance.timeOutAt && (
														<>
															{" • "}
															<span className='font-medium'>
																Clock Out:
															</span>{" "}
															{formatDate(attendance.timeOutAt.toDate())}
														</>
													)}
												</div>
												{attendance.notes && (
													<div className='text-xs text-gray-500'>
														{attendance.notes}
													</div>
												)}
											</div>
											<div className='text-right'>
												{attendance.totalMinutes !== undefined ? (
													<span className='font-medium text-[var(--accent)]'>
														{formatDuration(attendance.totalMinutes)}
													</span>
												) : (
													<div className='flex flex-row items-center gap-2'>
														<div className='bg-[var(--success)]/20 size-3 border-2 border-[var(--success)] border-dashed rounded-full shadow-sm animate-spin' />
														<span className='text-gray-500 text-sm'>
															Working
														</span>
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className='text-center py-8'>
									<div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
										<svg
											className='w-8 h-8 text-gray-400'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
											/>
										</svg>
									</div>
									<p className='text-gray-500'>No work sessions found</p>
									<p className='text-sm text-gray-400 mt-1'>
										Sessions from the last 30 days will appear here
									</p>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className='flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50'>
					<button
						onClick={onClose}
						className='px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors'>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
