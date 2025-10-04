import React, { useState, useEffect } from "react";
import { workerService, Worker } from "@/services/workerService";
import { Branch } from "@/services/branchService";

interface AssignBranchModalProps {
	isOpen: boolean;
	worker: Worker | null;
	branches: Branch[];
	userAccessibleBranches: string[];
	isAdmin: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export default function AssignBranchModal({
	isOpen,
	worker,
	branches,
	userAccessibleBranches,
	isAdmin,
	onClose,
	onSuccess,
}: AssignBranchModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [branchAssignments, setBranchAssignments] = useState<
		Array<{
			branchId: string;
			role: "manager" | "worker";
			isNew?: boolean;
		}>
	>([]);

	// Get available branches based on user permissions
	const availableBranches = isAdmin
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	// Initialize assignments when worker changes
	useEffect(() => {
		if (worker && isOpen) {
			setBranchAssignments(
				worker.roleAssignments
					.filter((assignment) => assignment.isActive)
					.map((assignment) => ({
						branchId: assignment.branchId,
						role: assignment.role,
					}))
			);
			setError(null);
		}
	}, [worker, isOpen]);

	const handleAssignmentChange = (
		branchId: string,
		role: "manager" | "worker",
		checked: boolean
	) => {
		setBranchAssignments((prev) => {
			if (checked) {
				// Add new assignment
				return [
					...prev.filter((a) => a.branchId !== branchId),
					{ branchId, role, isNew: true },
				];
			} else {
				// Remove assignment
				return prev.filter((a) => a.branchId !== branchId);
			}
		});
	};

	const handleRoleChange = (
		branchId: string,
		newRole: "manager" | "worker"
	) => {
		setBranchAssignments((prev) =>
			prev.map((assignment) =>
				assignment.branchId === branchId
					? { ...assignment, role: newRole }
					: assignment
			)
		);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!worker) return;

		if (branchAssignments.length === 0 && !worker.isAdmin) {
			setError("Worker must be assigned to at least one branch or be an admin");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const currentAssignments = worker.roleAssignments.filter(
				(a) => a.isActive !== false
			);

			// Remove assignments that are no longer selected
			for (const currentAssignment of currentAssignments) {
				const stillAssigned = branchAssignments.some(
					(a) => a.branchId === currentAssignment.branchId
				);
				if (!stillAssigned) {
					await workerService.removeWorkerFromBranch(
						worker.id,
						currentAssignment.branchId
					);
				}
			}

			// Add new assignments or update roles
			for (const newAssignment of branchAssignments) {
				const currentAssignment = currentAssignments.find(
					(a) => a.branchId === newAssignment.branchId
				);

				if (!currentAssignment) {
					// New assignment
					await workerService.assignWorkerToBranch(
						worker.id,
						newAssignment.branchId,
						newAssignment.role
					);
				} else if (currentAssignment.role !== newAssignment.role) {
					// Role change
					await workerService.updateWorkerRole(
						worker.id,
						newAssignment.branchId,
						newAssignment.role
					);
				}
			}

			onSuccess();
			handleClose();
		} catch (err: any) {
			console.error("Error updating branch assignments:", err);
			setError(err.message || "Failed to update branch assignments");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) {
			setError(null);
			onClose();
		}
	};

	if (!isOpen || !worker) return null;

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto'>
				{loading ? (
					<div className='text-center py-12'>
						<div className='w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-10 w-10 border-4 border-dashed border-[var(--accent)]'></div>
						</div>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							Updating Assignments...
						</h3>
						<p className='text-[var(--secondary)] opacity-70'>
							Saving branch assignments and roles
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='flex items-center justify-between mb-6'>
							<div className='flex items-center'>
								<div className='w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4'>
									<svg
										className='w-6 h-6 text-purple-600'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
										/>
									</svg>
								</div>
								<div>
									<h3 className='text-xl font-bold text-[var(--secondary)]'>
										Manage Branch Assignments
									</h3>
									<p className='text-sm text-[var(--secondary)]/70'>
										Assign worker to branches and set their roles
									</p>
								</div>
							</div>
							<button
								onClick={handleClose}
								className='text-gray-400 hover:text-gray-600 p-2'>
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

						{/* Worker Info */}
						<div className='bg-gray-50 rounded-lg p-4 mb-6'>
							<div className='flex items-center'>
								{worker.profilePicture ? (
									<img
										src={worker.profilePicture}
										alt=''
										className='w-12 h-12 rounded-full mr-4'
									/>
								) : (
									<div className='w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center mr-4'>
										<span className='text-lg font-medium text-gray-700'>
											{worker.name.charAt(0).toUpperCase()}
										</span>
									</div>
								)}
								<div>
									<div className='font-medium text-gray-900'>{worker.name}</div>
									<div className='text-sm text-gray-500'>{worker.email}</div>
									{worker.isAdmin && (
										<div className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1'>
											Admin
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Error Display */}
						{error && (
							<div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
								<div className='flex items-center'>
									<svg
										className='w-5 h-5 text-red-400 mr-2'
										fill='currentColor'
										viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
											clipRule='evenodd'
										/>
									</svg>
									<span className='text-red-700 text-sm'>{error}</span>
								</div>
							</div>
						)}

						{/* Branch Assignments */}
						<form onSubmit={handleSubmit} className='space-y-6'>
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-4'>
									Branch Assignments
									{!worker.isAdmin && (
										<span className='text-red-500 ml-1'>*</span>
									)}
								</label>

								{availableBranches.length === 0 ? (
									<div className='text-center py-8 text-gray-500'>
										No branches available for assignment
									</div>
								) : (
									<div className='space-y-3 max-h-80 overflow-y-auto'>
										{availableBranches.map((branch) => {
											const assignment = branchAssignments.find(
												(a) => a.branchId === branch.id
											);
											const isAssigned = !!assignment;
											const role = assignment?.role || "worker";

											return (
												<div
													key={branch.id}
													className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
														isAssigned
															? "border-[var(--accent)] bg-[var(--accent)]/5"
															: "border-gray-200 hover:border-gray-300"
													}`}>
													<div className='flex items-center'>
														<input
															type='checkbox'
															checked={isAssigned}
															onChange={(e) =>
																handleAssignmentChange(
																	branch.id,
																	role,
																	e.target.checked
																)
															}
															className='h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-gray-300 rounded'
														/>
														<div className='ml-4'>
															<div className='font-medium text-gray-900'>
																{branch.name}
															</div>
															<div className='text-sm text-gray-500'>
																{branch.location}
															</div>
														</div>
													</div>

													{isAssigned && (
														<div className='flex items-center space-x-2'>
															<select
																value={role}
																onChange={(e) =>
																	handleRoleChange(
																		branch.id,
																		e.target.value as "manager" | "worker"
																	)
																}
																className='px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'>
																<option value='worker'>Worker</option>
																<option value='manager'>Manager</option>
															</select>
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* Summary */}
							{branchAssignments.length > 0 && (
								<div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
									<h4 className='text-sm font-medium text-blue-800 mb-2'>
										Assignment Summary:
									</h4>
									<ul className='text-sm text-blue-700 space-y-1'>
										{branchAssignments.map((assignment) => {
											const branch = branches.find(
												(b) => b.id === assignment.branchId
											);
											return (
												<li key={assignment.branchId}>
													<span className='font-medium'>{branch?.name}</span> -{" "}
													{assignment.role}
												</li>
											);
										})}
									</ul>
								</div>
							)}

							{/* Form Actions */}
							<div className='flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200'>
								<button
									type='button'
									onClick={handleClose}
									className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors'>
									Cancel
								</button>
								<button
									type='submit'
									disabled={loading}
									className='flex-1 py-3 px-4 bg-[var(--accent)] text-[var(--primary)] rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50'>
									Save Assignments
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
