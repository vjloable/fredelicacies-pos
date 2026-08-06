import React, { useState, useEffect } from "react";
import { Branch } from "@/services/branchService";
import { workerService, Worker } from "@/services/workerService";
import DropdownField from "@/components/DropdownField";
import LoadingSpinner from "@/components/LoadingSpinner";

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

const ROLE_BLURB: Record<"team_leader" | "cashier", string> = {
	cashier: "Runs the register and daily sales at one branch.",
	team_leader: "Leads and oversees the whole operation of one branch.",
};

function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
	const [pinResetLoading, setPinResetLoading] = useState(false);
	const [pinResetDone, setPinResetDone] = useState(false);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		isOwner: false,
		branchAssignments: [] as Array<{
			branchId: string;
			role: "team_leader" | "cashier";
		}>,
	});

	// Single branch assignment state
	const [selectedBranchId, setSelectedBranchId] = useState<string>("");
	const [selectedRole, setSelectedRole] = useState<"team_leader" | "cashier">("cashier");
	const [originalRole, setOriginalRole] = useState<"team_leader" | "cashier" | null>(null);

	// Branches this editor is allowed to assign.
	const availableBranches = isOwner
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	// Whether the current editor may change this worker's role.
	const canChangeRole = (w: Worker | null): boolean => {
		if (!w || !currentUserId) return false;
		if (isOwner) return true; // owners can change anyone
		if (w.id === currentUserId) return false; // can't change your own role
		const isTeamLeader = w.roleAssignments.some(
			(a) => a.role === "team_leader" && a.isActive !== false
		);
		return !isTeamLeader; // managers can't touch other leaders
	};

	const roleOptions = (): string[] => {
		if (!worker) return ["Cashier"];
		if (!canChangeRole(worker)) {
			const current = worker.roleAssignments.find((a) => a.isActive !== false)?.role || "cashier";
			return [current === "cashier" ? "Cashier" : "Team Leader"];
		}
		return ["Cashier", "Team Leader"];
	};

	// Initialize form when the worker changes.
	useEffect(() => {
		if (!worker || !isOpen) return;

		const branchAssignments = worker.roleAssignments
			.filter((a) => a.isActive !== false)
			.map((a) => ({ branchId: a.branchId, role: a.role }));

		setFormData({
			name: worker.name,
			email: worker.email,
			isOwner: worker.isOwner,
			branchAssignments,
		});

		const currentAvailable = isOwner
			? branches
			: branches.filter((b) => userAccessibleBranches.includes(b.id));

		if (branchAssignments.length > 0) {
			setSelectedBranchId(branchAssignments[0].branchId);
			setSelectedRole(branchAssignments[0].role);
			setOriginalRole(branchAssignments[0].role);
		} else if (currentAvailable.length === 1) {
			setSelectedBranchId(currentAvailable[0].id);
			setSelectedRole("cashier");
			setOriginalRole("cashier");
		} else {
			setSelectedBranchId("");
			setSelectedRole("cashier");
			setOriginalRole("cashier");
		}

		setError(null);
	}, [worker, isOpen, isOwner, branches, userAccessibleBranches]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value, type, checked } = e.target;
		setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
	};

	const handleBranchChange = (branchId: string) => {
		setSelectedBranchId(branchId);
		setFormData((prev) => ({
			...prev,
			branchAssignments: branchId ? [{ branchId, role: selectedRole }] : [],
		}));
	};

	const handleRoleChange = (role: "team_leader" | "cashier") => {
		setSelectedRole(role);
		if (selectedBranchId) {
			setFormData((prev) => ({ ...prev, branchAssignments: [{ branchId: selectedBranchId, role }] }));
		}
	};

	const handlePinReset = async () => {
		if (!worker) return;
		setPinResetLoading(true);
		try {
			await workerService.resetWorkerPin(worker.id);
			setPinResetDone(true);
			setTimeout(() => setPinResetDone(false), 3000);
		} catch {
			setError("Couldn't reset the PIN. Please try again.");
		} finally {
			setPinResetLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!worker) return;

		if (!formData.name.trim() || !formData.email.trim()) {
			setError("Name and email are both required.");
			return;
		}
		if (!formData.isOwner && !selectedBranchId) {
			setError("Pick a branch for this person, or make them an owner.");
			return;
		}
		if (!isOwner && !canChangeRole(worker)) {
			setError("You don't have permission to change this person's role.");
			return;
		}
		// Managers can edit their own details but never move branch or change role.
		if (!isOwner) {
			const current = worker.roleAssignments.find((a) => a.isActive !== false);
			if (current?.branchId !== selectedBranchId || current?.role !== selectedRole) {
				setError("Only owners can change branch or role.");
				return;
			}
		}

		setLoading(true);
		setError(null);

		try {
			await workerService.updateWorker(worker.id, {
				name: formData.name,
				email: formData.email,
				isOwner: formData.isOwner,
			});

			if (isOwner && formData.isOwner !== worker.isOwner) {
				if (formData.isOwner) await workerService.promoteToOwner(worker.id);
				else await workerService.demoteFromOwner(worker.id);
			}

			if (isOwner && !formData.isOwner) {
				const current = worker.roleAssignments.find((a) => a.isActive !== false);
				const branchChanged = current?.branchId !== selectedBranchId;
				const roleChanged = current?.role !== selectedRole;

				if (!branchChanged && roleChanged && selectedBranchId) {
					await workerService.updateWorkerRole(worker.id, selectedBranchId, selectedRole);
				} else if (branchChanged) {
					if (current?.branchId) await workerService.removeWorkerFromBranch(worker.id, current.branchId);
					if (selectedBranchId) await workerService.assignWorkerToBranch(worker.id, selectedBranchId, selectedRole);
				}
			}

			// A role change shifts which route group the worker lands in, so refresh.
			if (originalRole !== selectedRole) {
				onSuccess();
				setTimeout(() => window.location.reload(), 500);
			} else {
				onSuccess();
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Couldn't save changes. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (loading) return;
		setError(null);
		onClose();
	};

	if (!isOpen || !worker) return null;

	const currentBranchName =
		availableBranches.find((b) => b.id === selectedBranchId)?.name ??
		branches.find((b) => b.id === selectedBranchId)?.name ??
		"No branch";
	const roleLabel = formData.isOwner
		? "Owner"
		: selectedRole === "cashier"
		? "Cashier"
		: "Team Leader";
	const canEditRole = isOwner && canChangeRole(worker);
	const canEditBranch = isOwner && availableBranches.length > 1;

	return (
		<div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto'>
				{loading ? (
					<div className='text-center py-16 px-8'>
						<LoadingSpinner size='lg' className='mx-auto' />
						<p className='text-secondary/70 mt-4'>Saving changes…</p>
					</div>
				) : (
					<form onSubmit={handleSubmit}>
						{/* Identity header — who am I editing? */}
						<div className='flex items-start gap-4 p-6 border-b border-secondary/10'>
							<div className='size-12 shrink-0 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm'>
								{initialsOf(formData.name || worker.name)}
							</div>
							<div className='min-w-0 flex-1'>
								<h2 className='text-lg font-bold text-secondary truncate'>
									{formData.name || worker.name}
								</h2>
								<p className='text-xs text-secondary/60 truncate'>{formData.email || worker.email}</p>
								<div className='flex flex-wrap items-center gap-1.5 mt-2'>
									<span className='inline-flex items-center rounded-full bg-accent/10 text-accent text-2.5 font-semibold px-2 py-0.5'>
										{roleLabel}
									</span>
									{!formData.isOwner && (
										<span className='inline-flex items-center rounded-full bg-secondary/8 text-secondary/60 text-2.5 font-medium px-2 py-0.5'>
											{currentBranchName}
										</span>
									)}
								</div>
							</div>
							<button
								type='button'
								aria-label='Close'
								onClick={handleClose}
								className='shrink-0 -mr-1 -mt-1 text-secondary/40 hover:text-secondary/70 p-1.5 rounded-lg hover:bg-secondary/5 transition-colors'>
								<svg className='size-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>

						<div className='p-6 space-y-6'>
							{error && (
								<div className='flex items-start gap-2 p-3 bg-error/5 border border-error/20 rounded-lg'>
									<svg className='size-4 text-error/60 mt-0.5 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
										<path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
									</svg>
									<span className='text-error text-xs'>{error}</span>
								</div>
							)}

							{/* Name + email */}
							<div className='space-y-4'>
								<div>
									<label className='block text-xs font-medium text-secondary/70 mb-1.5'>Name</label>
									<input
										type='text'
										name='name'
										value={formData.name}
										onChange={handleInputChange}
										className='w-full px-3 h-10 text-3 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										placeholder='Their full name'
										required
									/>
								</div>
								<div>
									<label className='block text-xs font-medium text-secondary/70 mb-1.5'>Email</label>
									<input
										type='email'
										name='email'
										value={formData.email}
										onChange={handleInputChange}
										className='w-full px-3 h-10 text-3 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										placeholder='name@example.com'
										required
									/>
								</div>
							</div>

							{/* Owner toggle — a real switch, clearly labelled */}
							{isOwner && (
								<label className='flex items-center justify-between gap-4 p-3 rounded-xl border border-secondary/15 cursor-pointer hover:bg-secondary/3 transition-colors'>
									<div>
										<p className='text-3 font-medium text-secondary'>Owner access</p>
										<p className='text-2.5 text-secondary/55 mt-0.5'>
											Full control of every branch. No branch or role assignment needed.
										</p>
									</div>
									<input
										type='checkbox'
										name='isOwner'
										checked={formData.isOwner}
										onChange={handleInputChange}
										className='size-5 shrink-0 rounded accent-accent'
									/>
								</label>
							)}

							{/* Branch + role — only when not an owner */}
							{!formData.isOwner && (
								<div className='space-y-4'>
									<div>
										<label className='block text-xs font-medium text-secondary/70 mb-1.5'>Branch</label>
										{canEditBranch ? (
											<DropdownField
												options={["Select a branch", ...availableBranches.map((b: Branch) => b.name)]}
												defaultValue={currentBranchName === "No branch" ? "Select a branch" : currentBranchName}
												onChange={(value) => {
													const branch = availableBranches.find((b: Branch) => b.name === value);
													handleBranchChange(branch ? branch.id : "");
												}}
												roundness='lg'
												height={40}
												valueAlignment='left'
												shadow={false}
												fontSize='14px'
												padding='12px'
												maxVisibleOptions={3}
											/>
										) : (
											<div className='w-full px-3 h-10 flex items-center text-3 bg-secondary/5 border border-secondary/15 rounded-lg text-secondary/60'>
												{currentBranchName}
											</div>
										)}
									</div>

									<div>
										<label className='block text-xs font-medium text-secondary/70 mb-1.5'>Role</label>
										{canEditRole ? (
											<DropdownField
												options={roleOptions()}
												defaultValue={selectedRole === "cashier" ? "Cashier" : "Team Leader"}
												onChange={(value) =>
													handleRoleChange(value === "Team Leader" ? "team_leader" : "cashier")
												}
												roundness='lg'
												height={40}
												valueAlignment='left'
												shadow={false}
												fontSize='14px'
												padding='12px'
											/>
										) : (
											<div className='w-full px-3 h-10 flex items-center justify-between text-3 bg-secondary/5 border border-secondary/15 rounded-lg text-secondary/60'>
												<span>{selectedRole === "cashier" ? "Cashier" : "Team Leader"}</span>
												<span className='text-2.5 text-secondary/40'>
													{!isOwner
														? "Owners only"
														: worker.id === currentUserId
														? "That's you"
														: "Can't change a leader"}
												</span>
											</div>
										)}
										<p className='text-2.5 text-secondary/50 mt-1.5'>{ROLE_BLURB[selectedRole]}</p>
									</div>
								</div>
							)}

							{/* PIN reset — owners only, not self, not other owners */}
							{isOwner && worker.id !== currentUserId && !worker.isOwner && (
								<div className='flex items-center justify-between gap-4 pt-4 border-t border-secondary/10'>
									<div>
										<p className='text-3 font-medium text-secondary'>Sign-in PIN</p>
										<p className='text-2.5 text-secondary/55 mt-0.5'>
											{pinResetDone
												? "Cleared — they'll set a new PIN at their next clock-in."
												: "Clear it if they forgot their PIN or need a new one."}
										</p>
									</div>
									<button
										type='button'
										onClick={handlePinReset}
										disabled={pinResetLoading || pinResetDone}
										className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
											pinResetDone
												? "bg-success/10 text-success"
												: "bg-error/10 text-error hover:bg-error/20"
										}`}>
										{pinResetLoading ? "Clearing…" : pinResetDone ? "PIN cleared ✓" : "Reset PIN"}
									</button>
								</div>
							)}
						</div>

						{/* Actions */}
						<div className='flex gap-3 p-6 border-t border-secondary/10'>
							<button
								type='button'
								onClick={handleClose}
								className='flex-1 h-11 border border-secondary/25 rounded-lg text-secondary/70 font-medium hover:bg-secondary/5 transition-colors'>
								Cancel
							</button>
							<button
								type='submit'
								disabled={loading}
								className='flex-1 h-11 bg-accent text-primary rounded-lg font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50'>
								Save changes
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
