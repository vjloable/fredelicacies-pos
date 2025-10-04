"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { branchService, Branch } from "@/services/branchService";
import TopBar from "@/components/TopBar";
import SettingsIcon from "@/components/icons/SidebarNav/SettingsIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import { formatCurrency } from "@/lib/currency_formatter";

// Helper function to format Firestore timestamps or dates
const formatDate = (date: any) => {
	if (!date) return "N/A";
	if (typeof date === "object" && "toDate" in date) {
		return date.toDate().toLocaleDateString();
	}
	return new Date(date).toLocaleDateString();
};

export default function WorkerSettingsPage() {
	const { user } = useAuth();
	const timeTracking = useTimeTracking({ autoRefresh: true });
	const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (timeTracking.worker) {
			loadAvailableBranches();
		}
	}, [timeTracking.worker]);

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

	// Don't show for admin users
	if (!user || !timeTracking.worker || timeTracking.worker.isAdmin) {
		return (
			<div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
				<div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center'>
					<div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
						<SettingsIcon className='w-8 h-8 text-blue-600' />
					</div>
					<h3 className='text-lg font-semibold text-gray-900 mb-2'>
						Worker Settings Not Available
					</h3>
					<p className='text-gray-600 text-sm'>
						{!user
							? "Please log in to access settings"
							: "Admin users use the main settings page"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gray-50'>
			<TopBar
				title='My Settings'
				icon={<SettingsIcon />}
				showTimeTracking={true}
			/>

			<div className='max-w-4xl mx-auto p-6 space-y-6'>
				{/* Profile Information */}
				<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
					<div className='px-6 py-4 border-b border-gray-200'>
						<h3 className='text-lg font-semibold text-gray-900'>
							Profile Information
						</h3>
						<p className='text-sm text-gray-600 mt-1'>
							Your basic profile and role information
						</p>
					</div>

					<div className='p-6'>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
							{/* Profile Details */}
							<div className='space-y-4'>
								<div>
									<label className='text-sm font-medium text-gray-700'>
										Name
									</label>
									<div className='mt-1 text-gray-900'>
										{timeTracking.worker.name}
									</div>
								</div>
								<div>
									<label className='text-sm font-medium text-gray-700'>
										Email
									</label>
									<div className='mt-1 text-gray-900'>
										{timeTracking.worker.email}
									</div>
								</div>
								{timeTracking.worker.phoneNumber && (
									<div>
										<label className='text-sm font-medium text-gray-700'>
											Phone
										</label>
										<div className='mt-1 text-gray-900'>
											{timeTracking.worker.phoneNumber}
										</div>
									</div>
								)}
								{timeTracking.worker.employeeId && (
									<div>
										<label className='text-sm font-medium text-gray-700'>
											Employee ID
										</label>
										<div className='mt-1 text-gray-900'>
											{timeTracking.worker.employeeId}
										</div>
									</div>
								)}
							</div>

							{/* Profile Picture */}
							<div className='flex flex-col items-center'>
								<div className='w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4'>
									{timeTracking.worker.profilePicture ? (
										<img
											src={timeTracking.worker.profilePicture}
											alt='Profile'
											className='w-full h-full object-cover rounded-full'
										/>
									) : (
										<span className='text-2xl font-semibold text-gray-600'>
											{timeTracking.worker.name.charAt(0).toUpperCase()}
										</span>
									)}
								</div>
								<p className='text-sm text-gray-600 text-center'>
									Profile picture updates must be done by your manager
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Work Status & Time Tracking */}
				<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
					<div className='px-6 py-4 border-b border-gray-200'>
						<h3 className='text-lg font-semibold text-gray-900'>
							Work Status & Time Tracking
						</h3>
						<p className='text-sm text-gray-600 mt-1'>
							Current work status and time tracking information
						</p>
					</div>

					<div className='p-6'>
						<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
							{/* Current Status */}
							<div className='space-y-4'>
								<div>
									<label className='text-sm font-medium text-gray-700'>
										Current Status
									</label>
									<div
										className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
											timeTracking.isWorking
												? "bg-green-100 text-green-800"
												: "bg-gray-100 text-gray-800"
										}`}>
										<div
											className={`w-2 h-2 rounded-full mr-2 ${
												timeTracking.isWorking
													? "bg-green-400 animate-pulse"
													: "bg-gray-400"
											}`}
										/>
										{timeTracking.isWorking ? "Clocked In" : "Clocked Out"}
									</div>
								</div>

								{timeTracking.isWorking && timeTracking.currentSession && (
									<>
										<div>
											<label className='text-sm font-medium text-gray-700'>
												Working Since
											</label>
											<div className='mt-1 text-gray-900'>
												{new Date(
													timeTracking.currentSession.timeInAt.toDate
														? timeTracking.currentSession.timeInAt.toDate()
														: timeTracking.currentSession.timeInAt
												).toLocaleString()}
											</div>
										</div>
										<div>
											<label className='text-sm font-medium text-gray-700'>
												Session Duration
											</label>
											<div className='mt-1 text-lg font-semibold text-blue-600'>
												{Math.floor(timeTracking.workingDuration / 60)}h{" "}
												{timeTracking.workingDuration % 60}m
											</div>
										</div>
									</>
								)}

								<div>
									<label className='text-sm font-medium text-gray-700'>
										POS System Access
									</label>
									<div
										className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
											timeTracking.isWorking
												? "bg-green-100 text-green-800"
												: "bg-red-100 text-red-800"
										}`}>
										{timeTracking.isWorking
											? "✓ Authorized"
											: "✗ Requires Clock-In"}
									</div>
									<p className='text-xs text-gray-500 mt-1'>
										You must be clocked in to access the POS system
									</p>
								</div>
							</div>

							{/* Time Tracking Info */}
							<div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
								<h4 className='font-medium text-blue-900 mb-3 flex items-center'>
									<ClockIcon className='w-4 h-4 mr-2' />
									Time Tracking Policy
								</h4>
								<div className='space-y-2 text-sm text-blue-800'>
									<p>• Clock in before starting your shift</p>
									<p>• POS access requires active clock-in status</p>
									<p>• Clock out when ending your shift</p>
									<p>• All time entries are automatically logged</p>
									<p>• Contact your manager for time corrections</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Branch Access & Roles */}
				<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
					<div className='px-6 py-4 border-b border-gray-200'>
						<h3 className='text-lg font-semibold text-gray-900'>
							Branch Access & Roles
						</h3>
						<p className='text-sm text-gray-600 mt-1'>
							Your assigned branches and roles
						</p>
					</div>

					<div className='p-6'>
						{timeTracking.worker.roleAssignments.length === 0 ? (
							<div className='text-center py-8'>
								<div className='w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
									<svg
										className='w-6 h-6 text-gray-400'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
										/>
									</svg>
								</div>
								<p className='text-gray-600'>No branch assignments found</p>
								<p className='text-gray-500 text-sm mt-1'>
									Contact your manager to get assigned to branches
								</p>
							</div>
						) : (
							<div className='space-y-4'>
								{timeTracking.worker.roleAssignments.map(
									(assignment, index) => {
										const branch = availableBranches.find(
											(b) => b.id === assignment.branchId
										);
										return (
											<div
												key={`${assignment.branchId}-${index}`}
												className={`flex items-center justify-between p-4 rounded-lg border ${
													assignment.isActive
														? "border-green-200 bg-green-50"
														: "border-gray-200 bg-gray-50"
												}`}>
												<div className='flex items-center space-x-4'>
													<div
														className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
															assignment.role === "manager"
																? "bg-blue-500"
																: "bg-green-500"
														}`}>
														{assignment.role === "manager" ? "M" : "W"}
													</div>
													<div>
														<div className='font-medium text-gray-900'>
															{branch ? branch.name : assignment.branchId}
														</div>
														<div className='text-sm text-gray-600'>
															Role:{" "}
															{assignment.role.charAt(0).toUpperCase() +
																assignment.role.slice(1)}
														</div>
														{branch?.location && (
															<div className='text-xs text-gray-500'>
																{branch.location}
															</div>
														)}
													</div>
												</div>
												<div className='text-right'>
													<div
														className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
															assignment.isActive
																? "bg-green-100 text-green-800"
																: "bg-gray-100 text-gray-800"
														}`}>
														{assignment.isActive ? "Active" : "Inactive"}
													</div>
													<div className='text-xs text-gray-500 mt-1'>
														Since {formatDate(assignment.assignedAt)}
													</div>
												</div>
											</div>
										);
									}
								)}
							</div>
						)}
					</div>
				</div>

				{/* Quick Actions */}
				<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
					<div className='px-6 py-4 border-b border-gray-200'>
						<h3 className='text-lg font-semibold text-gray-900'>
							Quick Actions
						</h3>
						<p className='text-sm text-gray-600 mt-1'>
							Common time tracking and work actions
						</p>
					</div>

					<div className='p-6'>
						<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
							<button className='flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors'>
								<ClockIcon className='w-8 h-8 text-blue-600 mb-2' />
								<span className='text-sm font-medium text-gray-900'>
									View Time History
								</span>
								<span className='text-xs text-gray-500'>
									See your work sessions
								</span>
							</button>

							<button className='flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors'>
								<svg
									className='w-8 h-8 text-green-600 mb-2'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
									/>
								</svg>
								<span className='text-sm font-medium text-gray-900'>
									Request Time Off
								</span>
								<span className='text-xs text-gray-500'>
									Submit leave request
								</span>
							</button>

							<button className='flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors'>
								<svg
									className='w-8 h-8 text-orange-600 mb-2'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
									/>
								</svg>
								<span className='text-sm font-medium text-gray-900'>
									Report Issue
								</span>
								<span className='text-xs text-gray-500'>
									Time or system issues
								</span>
							</button>
						</div>
					</div>
				</div>

				{/* Contact Information */}
				<div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
					<div className='flex items-start'>
						<svg
							className='w-5 h-5 text-yellow-400 mr-3 mt-0.5'
							fill='currentColor'
							viewBox='0 0 20 20'>
							<path
								fillRule='evenodd'
								d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
								clipRule='evenodd'
							/>
						</svg>
						<div>
							<h3 className='text-sm font-medium text-yellow-800'>
								Need Help?
							</h3>
							<div className='text-sm text-yellow-700 mt-1'>
								<p>Contact your manager or supervisor for:</p>
								<ul className='list-disc list-inside mt-1 space-y-1'>
									<li>Time corrections or issues</li>
									<li>Branch assignment changes</li>
									<li>Profile updates</li>
									<li>System access problems</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
