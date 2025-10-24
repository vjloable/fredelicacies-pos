"use client";

import React, { useEffect, useState } from "react";
import { Worker } from "@/services/workerService";
import { workSessionService, WorkSession } from "@/services/workSessionService";

import LoadingSpinner from "./LoadingSpinner";

interface WorkSessionWithMetadata extends WorkSession {
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
	const [workSessions, setWorkSessions] = useState<WorkSessionWithMetadata[]>(
		[]
	);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<"details" | "sessions">("details");

	useEffect(() => {
		if (isOpen && worker) {
			loadWorkerSessions();
		}
	}, [isOpen, worker]);

	const loadWorkerSessions = async () => {
		if (!worker) return;

		try {
			setLoading(true);
			const sessions = await workSessionService.getSessionsByDateRange(
				worker.id,
				new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
				new Date()
			);

			// Process sessions to add metadata
			const processedSessions = sessions.map((session, index) => ({
				...session,
				id: `session-${index}`,
				status: session.timeOutAt
					? "completed"
					: ("active" as "active" | "completed"),
				totalMinutes:
					session.duration ||
					(session.timeOutAt
						? workSessionService.calculateSessionDuration(
								session.timeInAt,
								session.timeOutAt
						  )
						: undefined),
				branchName: `Branch ${session.branchId}`,
			}));

			setWorkSessions(processedSessions);
		} catch (error) {
			console.error("Error loading worker sessions:", error);
		} finally {
			setLoading(false);
		}
	};

	const formatDate = (date: any) => {
		if (!date) return "N/A";
		const dateObj = date.toDate ? date.toDate() : date;
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(dateObj);
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

	const getRoleBadge = (role: string) => {
		const baseClasses = "px-2 py-1 text-xs rounded-full font-medium";
		switch (role) {
			case "manager":
				return `${baseClasses} bg-blue-100 text-blue-800`;
			case "worker":
				return `${baseClasses} bg-gray-100 text-gray-800`;
			default:
				return `${baseClasses} bg-gray-100 text-gray-600`;
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
						{worker.isAdmin && (
							<span className='bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 text-xs rounded-full font-medium'>
								Administrator
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
						Work Sessions (Last 30 Days)
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
												className='flex items-center justify-between p-4 bg-[var(--secondary)]/50 rounded-lg'>
												<div className='flex items-center gap-3'>
													<span className='font-medium'>
														{`Branch ${assignment.branchId}`}
													</span>
													<span className={getRoleBadge(assignment.role)}>
														{assignment.role}
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
							) : workSessions.length > 0 ? (
								<div className='space-y-3'>
									{workSessions.map((session) => (
										<div
											key={
												session.id || `${session.userId}-${session.timeInAt}`
											}
											className='flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'>
											<div className='space-y-1'>
												<div className='flex items-center gap-3'>
													<span className='font-medium'>
														{session.branchName || `Branch ${session.branchId}`}
													</span>
													<span
														className={`px-2 py-1 text-xs rounded-full font-medium ${
															session.status === "active"
																? "bg-green-100 text-green-800"
																: "bg-gray-100 text-gray-800"
														}`}>
														{session.status === "active"
															? "In Progress"
															: "Completed"}
													</span>
												</div>
												<div className='text-sm text-gray-600'>
													<span className='font-medium'>Clock In:</span>{" "}
													{formatDate(session.timeInAt)}
													{session.timeOutAt && (
														<>
															{" • "}
															<span className='font-medium'>
																Clock Out:
															</span>{" "}
															{formatDate(session.timeOutAt)}
														</>
													)}
												</div>
												{session.notes && (
													<div className='text-xs text-gray-500'>
														{session.notes}
													</div>
												)}
											</div>
											<div className='text-right'>
												{session.totalMinutes !== undefined ? (
													<span className='font-medium text-blue-600'>
														{formatDuration(session.totalMinutes)}
													</span>
												) : (
													<span className='text-gray-500 text-sm'>
														In Progress
													</span>
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
