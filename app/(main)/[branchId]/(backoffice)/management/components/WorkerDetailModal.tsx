"use client";

import React, { useEffect, useState } from "react";
import { Worker } from "@/services/workerService";
import { branchService } from "@/services/branchService";

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
	const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());

	useEffect(() => {
		if (!isOpen || !worker) return;
		let cancelled = false;
		(async () => {
			try {
				const branchIds = Array.from(
					new Set(worker.roleAssignments.map((assignment) => assignment.branchId))
				);
				const branchNameMap = new Map<string, string>();
				for (const branchId of branchIds) {
					const { branch } = await branchService.getBranchById(branchId);
					branchNameMap.set(branchId, branch?.name ?? `Branch ${branchId}`);
				}
				if (!cancelled) setBranchMap(branchNameMap);
			} catch (error) {
				console.error("Error loading branch names:", error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [isOpen, worker]);

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

	if (!isOpen || !worker) return null;

	return (
		<div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden'>
				{/* Header */}
				<div className='flex items-center justify-between p-6 border-b border-secondary/20'>
					<div className='flex items-center gap-4'>
						<div className='w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center'>
							<span className='text-secondary font-bold text-md'>
								{worker.name?.charAt(0) || worker.email.charAt(0)}
							</span>
						</div>
						<div>
							<h2 className='text-xs font-bold text-secondary'>
								{worker.name || "Unnamed Worker"}
							</h2>
							<p className='text-secondary text-xs'>{worker.email}</p>
						</div>
						{worker.isOwner && (
							<span className='bg-accent/10 text-accent px-2 py-1 text-xs rounded-full font-medium'>
								Owner
							</span>
						)}
					</div>
					<button aria-label="Close"
						onClick={onClose}
						className='text-secondary hover:text-secondary/60 transition-colors'>
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

				{/* Content */}
				<div className='p-6 overflow-y-auto max-h-[60vh]'>
					<div className='space-y-6'>
						{/* Basic Information */}
						<div className='grid grid-cols-1 md:grid-cols-1 gap-6'>
							<div className='space-y-4'>
								<h3 className='text-base font-semibold text-secondary'>
									Basic Information
								</h3>
								<div className='space-y-2'>
									<div className='flex justify-between'>
										<span className='text-secondary text-xs'>Employee ID:</span>
										<span className='font-medium text-xs'>{worker.id}</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-secondary text-xs'>Email:</span>
										<span className='font-medium text-xs'>{worker.email}</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-secondary text-xs'>Phone:</span>
										<span className='font-medium text-xs'>Not provided</span>
									</div>
								</div>
							</div>

							<div className='space-y-4'>
								<h3 className='text-base font-semibold text-secondary'>
									Employment Details
								</h3>
								<div className='space-y-2'>
									<div className='flex justify-between'>
										<span className='text-secondary text-xs'>Joined:</span>
										<span className='font-medium text-xs'>
											{formatDate(worker.createdAt)}
										</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-secondary text-xs'>Last Updated:</span>
										<span className='font-medium text-xs'>
											{formatDate(worker.updatedAt)}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Role Assignments */}
						<div className='space-y-4'>
							<h3 className='text-base font-semibold text-secondary'>
								Role Assignments
							</h3>
							{worker.roleAssignments && worker.roleAssignments.length > 0 ? (
								<div className='space-y-3'>
									{worker.roleAssignments.map((assignment, index) => (
										<div
											key={index}
											className='flex items-center justify-between p-4 bg-secondary/5 rounded-lg'>
											<div className='flex items-center gap-3'>
												<span className='font-medium'>
													{branchMap.get(assignment.branchId) || `Branch ${assignment.branchId}`}
												</span>
												<span className='rounded-full bg-accent text-primary text-xs px-3 py-1 font-bold '>
													{assignment.role === "team_leader" ? "Team Leader" : "Cashier"}
												</span>
											</div>
											<div className='flex items-center gap-2'>
												<span
													className={`px-2 py-1 text-xs rounded-full font-medium ${
														assignment.isActive
															? "bg-success/10 text-success"
															: "bg-error/10 text-error"
													}`}>
													{assignment.isActive ? "Active" : "Inactive"}
												</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className='text-secondary/50 italic text-xs'>No role assignments</p>
							)}
						</div>
					</div>
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
