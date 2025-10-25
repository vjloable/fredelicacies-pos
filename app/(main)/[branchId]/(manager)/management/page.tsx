"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workerService, Worker } from "@/services/workerService";
import { branchService, Branch } from "@/services/branchService";
import {
	collection,
	query,
	orderBy,
	onSnapshot,
	where,
} from "firebase/firestore";
import { db } from "@/firebase-config";
import { WorkerFilters as WorkerFiltersType } from "@/types/WorkerTypes";
import WorkersTable from "@/app/(main)/owner/users/components/WorkersTable";
import WorkerFiltersComponent from "@/app/(main)/owner/users/components/WorkerFilters";
import CreateWorkerModal from "@/app/(main)/owner/users/components/CreateWorkerModal";
import EditWorkerModal from "@/app/(main)/owner/users/components/EditWorkerModal";
import DeleteWorkerModal from "@/app/(main)/owner/users/components/DeleteWorkerModal";
import TimeInOutModal from "@/app/(main)/owner/users/components/TimeInOutModal";
import AssignBranchModal from "@/app/(main)/owner/users/components/AssignBranchModal";
import WorkerDetailModal from "@/app/(main)/[branchId]/(manager)/management/components/WorkerDetailModal";
import PlusIcon from "@/components/icons/PlusIcon";
import { useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ManagementIcon from "@/components/icons/SidebarNav/ManagementIcon";

export default function ManagementPage() {
	const {
		user,
		getUserRoleForBranch,
		canAccessBranch,
		loading: authLoading,
	} = useAuth();
	const { branchId } = useParams();
	const [workers, setWorkers] = useState<Worker[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Real-time subscription management
	const workerSubscriptions = useRef<Map<string, () => void>>(new Map());

	// Modal states
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [isTimeInOutModalOpen, setIsTimeInOutModalOpen] = useState(false);
	const [isAssignBranchModalOpen, setIsAssignBranchModalOpen] = useState(false);
	const [isWorkerDetailModalOpen, setIsWorkerDetailModalOpen] = useState(false);
	const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
	const [timeInOutAction, setTimeInOutAction] = useState<
		"time_in" | "time_out"
	>("time_in");

	// View mode (only attendance and workers for managers)
	const [viewMode, setViewMode] = useState<"workers" | "attendance">("workers");

	// Filters and sorting
	const [filters, setFilters] = useState<WorkerFiltersType>({
		branchId: branchId as string,
		excludeOwners: true, // Managers should not see owner workers
	});
	const [sortConfig, setSortConfig] = useState({
		column: "name",
		direction: "asc" as "asc" | "desc",
	});

	// Access control check - wait for auth loading to complete
	useEffect(() => {
		if (!authLoading && user && branchId) {
			const userRole = getUserRoleForBranch(branchId as string);
			const hasAccess = canAccessBranch(branchId as string);

			// Check if user has access and is either manager or admin
			if (!hasAccess) {
				setError("Access denied. You don't have access to this branch.");
				setLoading(false);
				return;
			} else if (!userRole || userRole === "worker") {
				setError(
					"Access denied. You need manager permissions for this branch."
				);
				setLoading(false);
				return;
			}

			// If user has proper access, clear any existing errors
			setError(null);
		}
	}, [user, branchId, getUserRoleForBranch, canAccessBranch, authLoading]);

	// Real-time workers collection setup
	const setupWorkerSubscriptions = useCallback(() => {
		if (!branchId || !user) return;

		try {
			console.log(
				`🔄 Setting up real-time subscription for branch ${branchId} workers...`
			);

			// Clean up existing subscriptions
			workerSubscriptions.current.forEach((unsubscribe) => unsubscribe());
			workerSubscriptions.current.clear();

			// Set up workers collection listener for this specific branch
			const workersRef = collection(db, "users");
			const workersQuery = query(
				workersRef,
				where("isOwner", "==", false), // Exclude admins for managers
				orderBy("name", "asc")
			);

			const unsubscribe = onSnapshot(
				workersQuery,
				(snapshot) => {
					const branchWorkers: Worker[] = [];

					snapshot.forEach((doc) => {
						const data = doc.data();
						console.log(`🔍 Checking worker ${data.name} (${doc.id}):`, {
							roleAssignments: data.roleAssignments,
							isOwner: data.isOwner,
							targetBranch: branchId,
						});

						// Check if worker has access to this branch through roleAssignments
						const hasBranchAccess = data.roleAssignments?.some(
							(assignment: any) => {
								console.log(
									`  - Assignment: ${assignment.branchId} === ${branchId} && ${assignment.isActive}`
								);
								return (
									assignment.branchId === branchId &&
									assignment.isActive === true
								);
							}
						);

						console.log(`  - Has branch access: ${hasBranchAccess}`);

						if (!hasBranchAccess) return; // Skip workers without access to this branch

						const worker: Worker = {
							id: doc.id,
							name: data.name || "",
							email: data.email || "",
							phoneNumber: data.phoneNumber,
							employeeId: data.employeeId,
							roleAssignments: data.roleAssignments || [],
							isOwner: data.isOwner || false,
							ownerAssignedBy: data.adminAssignedBy,
							ownerAssignedAt: data.adminAssignedAt?.toDate(),
							currentStatus: data.isOwner
								? undefined
								: data.currentStatus || "clocked_out",
							currentBranchId: data.currentBranchId,
							lastTimeIn: data.lastTimeIn?.toDate(),
							lastTimeOut: data.lastTimeOut?.toDate(),
							profilePicture: data.profilePicture,
							createdAt: data.createdAt?.toDate() || new Date(),
							updatedAt: data.updatedAt?.toDate() || new Date(),
							createdBy: data.createdBy || "",
							isActive: data.isActive !== false,
							lastLoginAt: data.lastLoginAt?.toDate(),
							passwordResetRequired: data.passwordResetRequired || false,
							twoFactorEnabled: data.twoFactorEnabled || false,
						};

						branchWorkers.push(worker);
					});

					console.log(
						`✅ Processed ${branchWorkers.length} workers for branch ${branchId}`
					);
					setWorkers(branchWorkers);
					// Don't set loading to false here - let the initial load handle it
				},
				(error) => {
					console.error("❌ Error in workers collection listener:", error);
					setError("Failed to load workers in real-time");
					setLoading(false);
				}
			);

			// Store the unsubscribe function
			workerSubscriptions.current.set("branch-workers", unsubscribe);
			console.log(
				`✅ Successfully set up real-time subscription for branch ${branchId} workers`
			);
		} catch (error) {
			console.error("❌ Error setting up workers collection listener:", error);
		}
	}, [branchId]);

	// Load data
	useEffect(() => {
		if (user && branchId) {
			console.log(`🔄 Loading workers for branch ${branchId}...`);
			loadWorkers();
			loadBranches();
		}
	}, [user, branchId]);

	// Cleanup subscriptions on unmount
	useEffect(() => {
		return () => {
			workerSubscriptions.current.forEach((unsubscribe) => unsubscribe());
			workerSubscriptions.current.clear();
		};
	}, []);

	const loadWorkers = async () => {
		if (!branchId) return;

		try {
			setLoading(true);
			console.log(`📋 Starting to load workers for branch ${branchId}...`);

			// Filter workers for current branch only, excluding owners
			const workerFilters: WorkerFiltersType = {
				branchId: branchId as string,
				excludeOwners: true, // New filter to exclude owners for managers
			};

			console.log(`📋 Using filters:`, workerFilters);
			const workersData = await workerService.listWorkers(workerFilters);
			setWorkers(workersData);
			setError(null);
			console.log(
				`📋 Initial load: ${workersData.length} workers loaded for branch ${branchId}`,
				workersData
			);

			// Set up real-time subscriptions after initial load
			setupWorkerSubscriptions();
		} catch (err) {
			console.error("Error loading workers:", err);
			setError("Failed to load workers");
		} finally {
			setLoading(false);
		}
	};

	const loadBranches = async () => {
		try {
			const branchesData = await branchService.getAllBranches();
			setBranches(branchesData);
		} catch (err) {
			console.error("Error loading branches:", err);
		}
	};

	const handleCreateWorker = () => {
		setSelectedWorker(null);
		setIsCreateModalOpen(true);
	};

	const handleEditWorker = (worker: Worker) => {
		setSelectedWorker(worker);
		setIsEditModalOpen(true);
	};

	const handleDeleteWorker = (worker: Worker) => {
		setSelectedWorker(worker);
		setIsDeleteModalOpen(true);
	};

	const handleTimeInOut = (worker: Worker, action: "time_in" | "time_out") => {
		setSelectedWorker(worker);
		setTimeInOutAction(action);
		setIsTimeInOutModalOpen(true);
	};

	const handleAssignBranch = (worker: Worker) => {
		setSelectedWorker(worker);
		setIsAssignBranchModalOpen(true);
	};

	const handleWorkerDetails = (worker: Worker) => {
		setSelectedWorker(worker);
		setIsWorkerDetailModalOpen(true);
	};

	const handleSort = (column: string) => {
		setSortConfig((prev) => ({
			column,
			direction:
				prev.column === column && prev.direction === "asc" ? "desc" : "asc",
		}));
	};

	const handleFiltersChange = (newFilters: WorkerFiltersType) => {
		setFilters({
			...newFilters,
			branchId: branchId as string, // Always maintain branch filter
			excludeOwners: true, // Always exclude owners for managers
		});
	};

	const handleModalClose = () => {
		setIsCreateModalOpen(false);
		setIsEditModalOpen(false);
		setIsDeleteModalOpen(false);
		setIsTimeInOutModalOpen(false);
		setIsAssignBranchModalOpen(false);
		setIsWorkerDetailModalOpen(false);
		setSelectedWorker(null);
	};

	const handleWorkerCreated = () => {
		handleModalClose();
		loadWorkers();
	};

	const handleWorkerUpdated = () => {
		handleModalClose();
		loadWorkers();
	};

	const handleWorkerDeleted = () => {
		handleModalClose();
		loadWorkers();
	};

	// Filter and sort workers
	const sortedWorkers = React.useMemo(() => {
		let filtered = [...workers];

		// Apply filters
		if (filters.searchQuery) {
			const searchLower = filters.searchQuery.toLowerCase();
			filtered = filtered.filter(
				(worker) =>
					worker.name.toLowerCase().includes(searchLower) ||
					worker.email.toLowerCase().includes(searchLower) ||
					worker.employeeId?.toLowerCase().includes(searchLower)
			);
		}

		if (filters.role) {
			filtered = filtered.filter((worker) => {
				if (filters.role === "owner") return worker.isOwner;
				if (filters.role === "worker") return !worker.isOwner;
				if (filters.role === "manager") {
					// Check if worker has manager role for any branch
					return worker.roleAssignments?.some(
						(assignment) => assignment.role === "manager"
					);
				}
				return true;
			});
		}

		if (filters.status) {
			filtered = filtered.filter(
				(worker) => worker.currentStatus === filters.status
			);
		}

		// Sort the filtered results
		return filtered.sort((a, b) => {
			const aValue = a[sortConfig.column as keyof Worker] as any;
			const bValue = b[sortConfig.column as keyof Worker] as any;

			if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
			if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [workers, sortConfig, filters]);

	// Show loading state while auth is loading OR while data is loading
	if (authLoading || loading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
					<div className='xl:hidden w-full'>
						<MobileTopBar
							title='Management'
							icon={<ManagementIcon />}
							showTimeTracking={true}
						/>
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
					<div className='hidden xl:block w-full'>
						<TopBar
							title='Management'
							icon={<ManagementIcon />}
							showTimeTracking={true}
						/>
					</div>
					<div className='flex-1 flex items-center justify-center gap-4'>
						<LoadingSpinner size="md"/>
						<p className='text-gray-500'>Loading...</p>
					</div>
				</div>
			</div>
		);
	}

	// Show access denied only after auth loading is complete
	if (!user) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
					<div className='xl:hidden w-full'>
						<MobileTopBar
							title='Management'
							icon={<ManagementIcon />}
							showTimeTracking={true}
						/>
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
					<div className='hidden xl:block w-full'>
						<TopBar
							title='Management'
							icon={<ManagementIcon />}
							showTimeTracking={true}
						/>
					</div>
					<div className='flex-1 flex items-center justify-center'>
						<div className='text-center'>
							<h2 className='text-xl font-semibold text-gray-700 mb-2'>
								Access Denied
							</h2>
							<p className='text-gray-500'>
								You need to be logged in to access this page.
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Show error state (after loading is complete)
	if (error) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
					<div className='xl:hidden w-full'>
						<MobileTopBar
							title='Management'
							icon={<ManagementIcon />}
							showTimeTracking={true}
						/>
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
					<div className='hidden xl:block w-full'>
						<TopBar
							title='Management'
							icon={<ManagementIcon />}
							showTimeTracking={true}
						/>
					</div>
					<div className='flex-1 flex items-center justify-center'>
						<div className='text-center'>
							<h2 className='text-xl font-semibold text-[var(--error)] mb-2'>Error</h2>
							<p className='text-[var(--error)]'>{error}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='flex h-full overflow-hidden'>
			{/* Main Content Area */}
			<div className='flex flex-col flex-1 h-full overflow-hidden'>
				{/* Header Section - Fixed */}
				{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
				<div className='xl:hidden w-full'>
					<MobileTopBar
						title={`Management`}
						icon={<ManagementIcon />}
						showTimeTracking={true}
					/>
				</div>
				{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
				<div className='hidden xl:block w-full'>
					<TopBar
						title={`Management`}
						icon={<ManagementIcon />}
						showTimeTracking={true}
					/>
				</div>
				<span className='flex h-6'></span>

				{/* Error Display */}
				{error && (
					<div className='mx-6 mb-4 p-2 bg-[var(--error)]/10 border border-[var(--error)]/40 rounded-lg'>
						<div className='flex items-center gap-3'>
							<svg
								className='w-5 h-5 text-[var(--error)]'
								fill='currentColor'
								viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clipRule='evenodd'
								/>
							</svg>
							<span className='text-[var(--error)] font-medium text-[12px]'>
								{error}
							</span>
							<button
								onClick={() => setError(null)}
								className='ml-auto text-[var(--error)] hover:text-[var(--error)]/20'>
								✕
							</button>
						</div>
					</div>
				)}

				{/* Loading State */}
				{loading && (
					<div className='flex items-center justify-center py-8'>
						<LoadingSpinner size='md' />
						<span className='ml-3 text-[var(--secondary)]'>
							Loading workers...
						</span>
					</div>
				)}

				{/* Main Content - Scrollable */}
				{!loading && (
					<div className='flex-1 px-6 overflow-y-auto pb-6'>
						{/* Control Bar */}
						<div className='mb-6'>
							<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4'>
								<div className='flex items-center gap-4 text-sm text-[var(--secondary)]/70'>
									<span className='flex items-center gap-2'>
										<span className='w-2 h-2 bg-[var(--accent)] rounded-full'></span>
										{branches.find((branch) => branch.id === branchId)?.name ||
											"Loading..."}
									</span>
								</div>

								<div className='flex flex-col sm:flex-row sm:items-center gap-4'>
									{/* View Toggle */}
									<div className='flex bg-[var(--accent)]/20 rounded-lg p-1 border-[var(--accent)]/30 border w-full sm:w-auto'>
										<button
											onClick={() => setViewMode("workers")}
											className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-sm font-medium transition-colors ${
												viewMode === "workers"
													? "bg-white text-[var(--secondary)] shadow-sm"
													: "text-[var(--secondary)]/60 hover:text-[var(--secondary)]"
											}`}>
											Workers
										</button>
										<button
											onClick={() => setViewMode("attendance")}
											className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-sm font-medium transition-colors ${
												viewMode === "attendance"
													? "bg-white text-[var(--secondary)] shadow-sm"
													: "text-[var(--secondary)]/60 hover:text-[var(--secondary)]"
											}`}>
											Attendance
										</button>
									</div>

									{/* Add Worker Button - only show in workers view */}
									{viewMode === "workers" && (
										<button
											onClick={handleCreateWorker}
											className='w-full sm:w-auto bg-[var(--accent)] text-[var(--secondary)] text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95'>
											<div className='flex flex-row items-center justify-center gap-2 text-[var(--primary)] text-shadow-sm font-black text-[14px]'>
												<div className='w-4 h-4'>
													<PlusIcon className='drop-shadow-sm' />
												</div>
												<span className='mt-[2px]'>ADD WORKER</span>
											</div>
										</button>
									)}
								</div>
							</div>

							{/* Filters - only show in workers view */}
							{viewMode === "workers" && (
								<div className='mb-4'>
									<WorkerFiltersComponent
										filters={filters}
										branches={[]} // No branches shown for managers - they only see their branch
										onFiltersChange={handleFiltersChange}
										userAccessibleBranches={[branchId as string]}
										isOwner={false} // Managers see only their branch
										hideBranchFilter={true} // Hide branch filter for managers
										hideOwnerRole={true} // Hide owner role option for managers
									/>
								</div>
							)}
						</div>

						{/* Content */}
						<div className='space-y-4'>
							{viewMode === "workers" ? (
								<>
									<WorkersTable
										workers={sortedWorkers}
										currentUser={user}
										branches={branches}
										loading={loading}
										sortConfig={sortConfig}
										onSort={handleSort}
										onEdit={handleEditWorker}
										onDelete={handleDeleteWorker}
										onTimeIn={(worker) => handleTimeInOut(worker, "time_in")}
										onTimeOut={(worker) => handleTimeInOut(worker, "time_out")}
										onAssignBranch={handleAssignBranch}
										onRowClick={handleWorkerDetails}
									/>

									{/* Stats */}
									<div className='mt-6 text-sm text-gray-500'>
										Showing {sortedWorkers.length} of {workers.length} worker
										{workers.length !== 1 ? "s" : ""} for this branch
										{sortedWorkers.length !== workers.length && (
											<span className='ml-2 text-[var(--accent)]'>
												(filtered)
											</span>
										)}
									</div>
								</>
							) : (
								/* Attendance View - Placeholder for now */
								<div className='text-center py-12'>
									<div className='text-2xl text-gray-400 mb-4'>📊</div>
									<h3 className='text-lg font-semibold text-gray-700 mb-2'>
										Attendance Management
									</h3>
									<p className='text-gray-500'>
										Attendance tracking features will be implemented here.
									</p>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Modals */}
				<CreateWorkerModal
					isOpen={isCreateModalOpen}
					onClose={handleModalClose}
					onSuccess={handleWorkerCreated}
					branches={branches.filter((branch) => branch.id === branchId)}
					userAccessibleBranches={[branchId as string]}
					isOwner={false} // Managers can only add workers to their branch
					defaultBranchId={branchId as string}
				/>

				<EditWorkerModal
					isOpen={isEditModalOpen}
					worker={selectedWorker}
					onClose={handleModalClose}
					onSuccess={handleWorkerUpdated}
					branches={branches.filter((branch) => branch.id === branchId)}
					userAccessibleBranches={[branchId as string]}
					isOwner={false}
					currentUserId={user?.uid}
				/>

				<DeleteWorkerModal
					isOpen={isDeleteModalOpen}
					worker={selectedWorker}
					onClose={handleModalClose}
					onSuccess={handleWorkerDeleted}
				/>

				<TimeInOutModal
					isOpen={isTimeInOutModalOpen}
					worker={selectedWorker}
					action={timeInOutAction}
					branches={branches.filter((branch) => branch.id === branchId)}
					onClose={handleModalClose}
					onSuccess={handleWorkerUpdated}
				/>

				<AssignBranchModal
					isOpen={isAssignBranchModalOpen}
					worker={selectedWorker}
					branches={branches.filter((branch) => branch.id === branchId)}
					userAccessibleBranches={[branchId as string]}
					isOwner={false}
					onClose={handleModalClose}
					onSuccess={handleWorkerUpdated}
				/>

				<WorkerDetailModal
					isOpen={isWorkerDetailModalOpen}
					worker={selectedWorker}
					onClose={handleModalClose}
				/>
			</div>
		</div>
	);
}
