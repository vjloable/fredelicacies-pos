import React, { useState, useEffect } from "react";
import { Branch } from "@/services/branchService";
import { workerService, Worker } from "@/services/workerService";
import DropdownField from "@/components/DropdownField";

interface EditWorkerModalProps {
	isOpen: boolean;
	worker: Worker | null;
	onClose: () => void;
	onSuccess: () => void;
	branches?: Branch[];
	userAccessibleBranches?: string[];
	isOwner?: boolean;
	currentUserId?: string;
}

export default function EditWorkerModal({
	isOpen,
	worker,
	onClose,
	onSuccess,
	branches = [],
	userAccessibleBranches = [],
	isOwner = false,
	currentUserId,
}: EditWorkerModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phoneNumber: "",
		employeeId: "",
		isOwner: false,
		branchAssignments: [] as Array<{
			branchId: string;
			role: "manager" | "worker";
		}>,
	});

	// Single branch assignment state
	const [selectedBranchId, setSelectedBranchId] = useState<string>("");
	const [selectedRole, setSelectedRole] = useState<"manager" | "worker">(
		"worker"
	);
	const [originalRole, setOriginalRole] = useState<"manager" | "worker" | null>(null);

	// Get available branches based on user permissions
	const availableBranches = isOwner
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	// Check if the current user can change roles for this worker
	const canDemoteWorker = (worker: Worker | null): boolean => {
		if (!worker || !currentUserId) return false;

		// Owners can change any role
		if (isOwner) return true;
		
		// Managers cannot demote themselves
		if (worker.id === currentUserId) return false;
		
		// Managers cannot demote other managers - check if worker is a manager
		const isWorkerManager = worker.roleAssignments.some(
			assignment => assignment.role === "manager" && assignment.isActive !== false
		);
		
		if (isWorkerManager) return false;
		
		// Managers can only change worker roles (not demote managers)
		return true;
	};

	// Get available role options based on permissions
	const getAvailableRoleOptions = (): string[] => {
		if (!worker) return ["Worker"];
		
		if (!canDemoteWorker(worker)) {
			// If can't demote, only show current role
			const currentRole = worker.roleAssignments.find(
				assignment => assignment.isActive !== false
			)?.role || "worker";
			return [currentRole === "worker" ? "Worker" : "Manager"];
		}
		
		// Full options if can demote
		return ["Worker", "Manager"];
	};

	// Initialize form data when worker changes
	useEffect(() => {
		if (worker && isOpen) {
			const branchAssignments = worker.roleAssignments
				.filter((assignment) => assignment.isActive !== false)
				.map((assignment) => ({
					branchId: assignment.branchId,
					role: assignment.role,
				}));

			console.log("Initializing EditWorkerModal with:", {
				workerName: worker.name,
				roleAssignments: worker.roleAssignments,
				activeBranchAssignments: branchAssignments,
				isOwner,
				availableBranches: availableBranches.length,
				userAccessibleBranches
			});

			setFormData({
				name: worker.name,
				email: worker.email,
				phoneNumber: worker.phoneNumber || "",
				employeeId: worker.employeeId || "",
				isOwner: worker.isOwner,
				branchAssignments,
			});

			// Get current available branches
			const currentAvailableBranches = isOwner
				? branches
				: branches.filter((branch) =>
						userAccessibleBranches.includes(branch.id)
				  );

			// Set single branch assignment
			if (branchAssignments.length > 0) {
				const currentAssignment = branchAssignments[0];
				setSelectedBranchId(currentAssignment.branchId);
				setSelectedRole(currentAssignment.role);
				setOriginalRole(currentAssignment.role);
				console.log("✅ Initialized with existing assignment:", { 
					branchId: currentAssignment.branchId, 
					role: currentAssignment.role 
				});
			} else if (currentAvailableBranches.length === 1) {
				// Auto-select the only available branch for managers
				setSelectedBranchId(currentAvailableBranches[0].id);
				setSelectedRole("worker");
				setOriginalRole("worker");
				console.log("✅ Auto-selected branch for manager:", currentAvailableBranches[0].id);
			} else {
				setSelectedBranchId("");
				setSelectedRole("worker");
				setOriginalRole("worker");
				console.log("⚠️ No branch assignments found");
			}

			setError(null);
		}
	}, [worker, isOpen, isOwner, branches, userAccessibleBranches, availableBranches.length]);

	// Debug logging for render conditions
	useEffect(() => {
		if (isOpen && worker) {
			console.log("🎯 Modal render state:", {
				workerisOwner: formData.isOwner,
				availableBranches: availableBranches.length,
				selectedRole,
				selectedBranchId,
				shouldShowRoleDropdown: !formData.isOwner
			});
		}
	}, [isOpen, worker, formData.isOwner, availableBranches.length, selectedRole, selectedBranchId]);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value, type } = e.target;
		const checked = (e.target as HTMLInputElement).checked;

		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const handleBranchChange = (branchId: string) => {
		setSelectedBranchId(branchId);
		setFormData((prev) => ({
			...prev,
			branchAssignments: branchId ? [{ branchId, role: selectedRole }] : [],
		}));
	};

	const handleRoleChange = (role: "manager" | "worker") => {
		console.log("🔄 Role change attempted:", { role, selectedBranchId, isOwner });
		setSelectedRole(role);
		if (selectedBranchId) {
			const updatedAssignments = [{ branchId: selectedBranchId, role }];
			setFormData((prev) => ({
				...prev,
				branchAssignments: updatedAssignments,
			}));
			console.log("✅ Role change updated in form data:", { 
				role, 
				branchId: selectedBranchId,
				branchAssignments: updatedAssignments
			});
		} else {
			console.log("⚠️ No branch selected, cannot update role");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!worker) return;

		console.log("🚀 Form submission started:", {
			workerId: worker.id,
			currentRole: worker.roleAssignments,
			newRole: selectedRole,
			selectedBranchId,
			isOwner: formData.isOwner,
			availableBranches: availableBranches.length
		});

		if (!formData.name.trim() || !formData.email.trim()) {
			setError("Please fill in all required fields");
			return;
		}

		if (!selectedBranchId && !formData.isOwner) {
			setError("Please select a branch assignment or make them an admin");
			return;
		}

		if (!formData.isOwner && !selectedRole) {
			setError("Please select a role for the worker");
			return;
		}

		// Additional validation for manager permissions
		if (!isOwner && !canDemoteWorker(worker)) {
			setError("You do not have permission to change this user's role");
			return;
		}

		// Prevent managers from changing branch assignments or roles
		if (!isOwner) {
			const currentBranchAssignment = worker.roleAssignments.find(
				(a) => a.isActive !== false
			);
			const currentBranch = currentBranchAssignment?.branchId;
			const currentRole = currentBranchAssignment?.role;

			if (currentBranch !== selectedBranchId || currentRole !== selectedRole) {
				setError("Only owners can change branch assignments and roles");
				return;
			}
		}

		setLoading(true);
		setError(null);

		try {
			// Update worker data
			await workerService.updateWorker(worker.id, {
				name: formData.name,
				email: formData.email,
				phoneNumber: formData.phoneNumber,
				employeeId: formData.employeeId,
				isOwner: formData.isOwner,
			});

			// Handle admin role changes (only for owners)
			if (isOwner && formData.isOwner !== worker.isOwner) {
				if (formData.isOwner) {
					await workerService.promoteToOwner(worker.id);
				} else {
					await workerService.demoteFromOwner(worker.id);
				}
			}

		// Update branch assignments if not admin (only for owners)
		if (isOwner && !formData.isOwner) {
			const currentAssignments = worker.roleAssignments.filter(
				(a) => a.isActive !== false
			);

			// Check if role actually changed
			const currentRole = currentAssignments.find(a => a.branchId === selectedBranchId)?.role;
			const roleChanged = currentRole !== selectedRole;

			console.log("🔄 Updating branch assignments:", {
				workerId: worker.id,
				currentAssignments,
				currentRole,
				newRole: selectedRole,
				newBranch: selectedBranchId,
				roleChanged
			});

			// Remove all old assignments first
			for (const currentAssignment of currentAssignments) {
				console.log("🗑️ Removing assignment:", currentAssignment);
				await workerService.removeWorkerFromBranch(
					worker.id,
					currentAssignment.branchId
				);
			}

			// Add the new single assignment if selected
			if (selectedBranchId) {
				console.log("➕ Adding new assignment:", { 
					branchId: selectedBranchId, 
					role: selectedRole,
					changed: roleChanged
				});
				await workerService.assignWorkerToBranch(
					worker.id,
					selectedBranchId,
					selectedRole
				);
			}
		}			
			console.log("✅ Worker updated successfully!");
			
			// Check if role was changed to determine if we need to reload
			const roleChanged = originalRole !== selectedRole;
			console.log("🔄 Role change status:", { originalRole, selectedRole, roleChanged });
			
			if (roleChanged) {
				console.log("🔄 Role was changed, reloading page...");
				// Close modal first
				onSuccess();
				// Small delay to ensure modal closes, then reload
				setTimeout(() => {
					window.location.reload();
				}, 500);
			} else {
				onSuccess();
			}
		} catch (err: unknown) {
			console.error("❌ Error updating worker:", err);
			const errorMessage = err instanceof Error ? err.message : "Failed to update worker";
			setError(`Update failed: ${errorMessage}`);
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
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto'>
				{loading ? (
					<div className='text-center py-12'>
						<div className='w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-10 w-10 border-4 border-dashed border-accent'></div>
						</div>
						<h3 className='text-lg font-bold text-secondary mb-2'>
							Updating Worker...
						</h3>
						<p className='text-secondary opacity-70'>
							Saving changes to worker account
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='flex items-center justify-between mb-6'>
							<div>
								<h2 className='text-xl font-bold text-secondary'>
									Edit Worker
								</h2>
								<p className='text-xs text-secondary/70 mt-1'>
									Update worker information and role assignments
								</p>
							</div>
							<button
								onClick={handleClose}
								className='text-secondary/40 hover:text-secondary/60 p-2'>
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

						{/* Error Display */}
						{error && (
							<div className='mb-6 p-4 bg-r(--error)/5 border border-(--error)/20 rounded-lg'>
								<div className='flex items-center'>
									<svg
										className='w-5 h-5 text-(--error)/40 mr-2'
										fill='currentColor'
										viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
											clipRule='evenodd'
										/>
									</svg>
									<span className='text-(--error) text-xs'>{error}</span>
								</div>
							</div>
						)}

						{/* Form */}
						<form onSubmit={handleSubmit} className='space-y-6'>
							{/* Basic Information */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-medium text-secondary/70 mb-2'>
										Full Name <span className="text-(--error)">*</span>
									</label>
									<input
										type='text'
										name='name'
										value={formData.name}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-secondary/30 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent'
										placeholder='Enter full name'
										required
									/>
								</div>
								<div>
									<label className='block text-xs font-medium text-gray-700 mb-2'>
										Email Address <span className="text-(--error)">*</span>
									</label>
									<input
										type='email'
										name='email'
										value={formData.email}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent'
										placeholder='Enter email address'
										required
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-medium text-gray-700 mb-2'>
										Phone Number
									</label>
									<input
										type='tel'
										name='phoneNumber'
										value={formData.phoneNumber}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent'
										placeholder='Enter phone number'
									/>
								</div>
								<div>
									<label className='block text-xs font-medium text-gray-700 mb-2'>
										Employee ID
									</label>
									<input
										type='text'
										name='employeeId'
										value={formData.employeeId}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent'
										placeholder='Enter employee ID (optional)'
									/>
								</div>
							</div>

							{/* Owner Toggle */}
							{isOwner && (
								<div className='flex items-center'>
									<input
										type='checkbox'
										name='isOwner'
										checked={formData.isOwner}
										onChange={handleInputChange}
										className='h-5 w-5 text-primary focus:ring-accent border-secondary/30 rounded'
									/>
									<label className='ml-2 block text-xs text-secondary p-1'>
										Grant admin privileges
									</label>
								</div>
							)}

							{/* Branch Assignment */}
							{!formData.isOwner && (
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div>
										<label className='block text-xs font-medium text-gray-700 mb-2'>
											Assign to Branch <span className="text-(--error)">*</span>
										</label>
										{!isOwner || availableBranches.length === 1 ? (
											// For managers - show readonly branch name (no changes allowed)
											<div className='w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700'>
												{availableBranches[0]?.name || selectedBranchId}
											</div>
										) : (
											// For admins - show dropdown
											<DropdownField
												options={[
													"Select a branch",
													...availableBranches.map(
														(branch: Branch) => branch.name
													),
												]}
												defaultValue={
													selectedBranchId
														? availableBranches.find(
																(b: Branch) => b.id === selectedBranchId
														  )?.name
														: "Select a branch"
												}
												onChange={(value) => {
													if (value === "Select a branch") {
														handleBranchChange("");
													} else {
														const branch = availableBranches.find(
															(b: Branch) => b.name === value
														);
														if (branch) {
															handleBranchChange(branch.id);
														}
													}
												}}
												roundness='lg'
												height={42}
												valueAlignment='left'
												shadow={false}
												fontSize='14px'
												padding='12px'
												maxVisibleOptions={3}
											/>
										)}
									</div>
									<div>
										<label className='block text-xs font-medium text-gray-700 mb-2'>
											Role <span className="text-(--error)">*</span>
										</label>
										{isOwner && canDemoteWorker(worker) ? (
											<DropdownField
												options={getAvailableRoleOptions()}
												defaultValue={
													selectedRole === "worker" ? "Worker" : "Manager"
												}
												onChange={(value) => {
													handleRoleChange(
														value.toLowerCase() as "manager" | "worker"
													);
												}}
												roundness='lg'
												height={42}
												valueAlignment='left'
												shadow={false}
												fontSize='14px'
												padding='12px'
											/>
										) : (
											// Show readonly role for managers or when cannot demote
											<div className='w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 flex items-center justify-between'>
												<span>{selectedRole === "worker" ? "Worker" : "Manager"}</span>
												{!isOwner && (
													<span className='text-xs text-gray-500'>(Only owners can change roles)</span>
												)}
												{isOwner && worker?.id === currentUserId && (
													<span className='text-xs text-gray-500'>(Cannot change own role)</span>
												)}
												{isOwner && worker?.roleAssignments.some(a => a.role === "manager" && a.isActive !== false) && worker?.id !== currentUserId && (
													<span className='text-xs text-gray-500'>(Cannot demote managers)</span>
												)}
											</div>
										)}
									</div>
								</div>
							)}

							{/* Form Actions */}
							<div className='flex flex-col sm:flex-row gap-3 pt-6 border-t border-secondary/20'>
								<button
									type='button'
									onClick={handleClose}
									className='flex-1 py-3 px-4 border border-secondary/30 rounded-lg text-secondary/70 font-medium hover:bg-secondary/20 transition-colors'>
									Cancel
								</button>
								<button
									type='submit'
									disabled={loading}
									className='flex-1 py-3 px-4 bg-accent text-primary rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50'>
									Update Worker
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
