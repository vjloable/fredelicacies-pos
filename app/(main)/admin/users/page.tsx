"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { RoleAssignment, useAuth } from "@/contexts/AuthContext";
import { workerService, Worker } from "@/services/workerService";
import { branchService, Branch } from "@/services/branchService";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase-config";
import { WorkerFilters as WorkerFiltersType } from "@/types/WorkerTypes";
import WorkersTable from "./components/WorkersTable";
import WorkerFiltersComponent from "./components/WorkerFilters";
import CreateWorkerModal from "./components/CreateWorkerModal";
import EditWorkerModal from "./components/EditWorkerModal";
import DeleteWorkerModal from "./components/DeleteWorkerModal";
import TimeInOutModal from "./components/TimeInOutModal";
import AssignBranchModal from "./components/AssignBranchModal";
import WorkerDetailModal from "@/components/WorkerDetailModal";
import PlusIcon from "@/components/icons/PlusIcon";
import AdvancedReporting from "./components/AdvancedReporting";
import WorkScheduleManagement from "./components/WorkScheduleManagement";
import TopBar from "@/components/TopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import DropdownField from "@/components/DropdownField";

export default function WorkersPage() {
	const {
		user,
		hasWorkerManagementAccess,
		getAccessibleBranches,
		loading: authLoading,
	} = useAuth();
	const [workers, setWorkers] = useState<Worker[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [selectedBranchId, setSelectedBranchId] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Real-time subscription management
	const workerSubscriptions = useRef<Map<string, () => void>>(new Map());

	// Debug worker state changes
	useEffect(() => {
		console.log(
			"🔍 Workers state updated:",
			workers.length,
			workers.map((w) => w.name)
		);
	}, [workers]);

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

	// View mode
	const [viewMode] = useState<"workers" | "analytics" | "schedule">("workers");

	// Filters
	const [filters, setFilters] = useState<WorkerFiltersType>({});
	const [sortConfig, setSortConfig] = useState<{
		column: string;
		direction: "asc" | "desc";
	}>({ column: "name", direction: "asc" });

	// Check access only after auth loading is complete
	useEffect(() => {
		if (!authLoading && user && !hasWorkerManagementAccess()) {
			setError("You don't have permission to access worker management.");
			setLoading(false);
		}
	}, [user, hasWorkerManagementAccess, authLoading]);

	// Setup single collection subscription for all workers
	const setupWorkerSubscriptions = useCallback(() => {
		// Clean up existing subscriptions first
		workerSubscriptions.current.forEach((unsubscribe) => unsubscribe());
		workerSubscriptions.current.clear();

		console.log("🔗 Setting up single real-time subscription for all workers");

		try {
			// Create query for users collection
			const usersRef = collection(db, "users");
			const q = query(usersRef, orderBy("name", "asc"));

			// Set up real-time listener
			const unsubscribe = onSnapshot(
				q,
				(querySnapshot) => {
					console.log(
						`Real-time update: ${querySnapshot.size} workers received from Firestore`
					);

					const updatedWorkers: Worker[] = [];

					querySnapshot.forEach((doc) => {
						const data = doc.data();

						// Convert Firestore data to Worker format (same as workerService.listWorkers)
						const worker: Worker = {
							id: doc.id,
							name: data.name || "",
							email: data.email || "",
							phoneNumber: data.phoneNumber,
							employeeId: data.employeeId,
							roleAssignments: data.roleAssignments || [],
							isAdmin: data.isAdmin || false,
							adminAssignedBy: data.adminAssignedBy,
							adminAssignedAt: data.adminAssignedAt?.toDate(),
							currentStatus: data.isAdmin
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

						// Apply current filters locally (same logic as workerService)
						if (filters?.searchQuery) {
							const searchTerm = filters.searchQuery.toLowerCase();
							const matchesSearch =
								data.name?.toLowerCase().includes(searchTerm) ||
								data.email?.toLowerCase().includes(searchTerm) ||
								data.employeeId?.toLowerCase().includes(searchTerm);
							if (!matchesSearch) return;
						}

						// Apply selectedBranchId filter for admins
						const currentBranchFilter = selectedBranchId || filters?.branchId;
						if (currentBranchFilter) {
							const hasBranchAccess = data.roleAssignments?.some(
								(assignment: RoleAssignment) =>
									assignment.branchId === currentBranchFilter &&
									assignment.isActive === true
							);
							if (!hasBranchAccess) return;
						}

						if (filters?.role) {
							if (filters.role === "admin" && !data.isAdmin) return;
							if (filters.role !== "admin") {
								const hasRole = data.roleAssignments?.some(
									(assignment: RoleAssignment) =>
										assignment.role === filters.role &&
										assignment.isActive === true
								);
								if (!hasRole) return;
							}
						}

						if (filters?.status && !data.isAdmin) {
							if (data.currentStatus !== filters.status) return;
						}

						updatedWorkers.push(worker);
					});

					console.log(
						`✅ Processed ${updatedWorkers.length} workers after filtering`
					);
					setWorkers(updatedWorkers);
				},
				(error) => {
					console.error("❌ Error in workers collection listener:", error);
				}
			);

			// Store the unsubscribe function
			workerSubscriptions.current.set("all-workers", unsubscribe);
			console.log(
				"✅ Successfully set up real-time subscription for all workers"
			);
		} catch (error) {
			console.error("❌ Error setting up workers collection listener:", error);
		}
	}, [filters, selectedBranchId]);

	// Load data only after auth loading is complete
	useEffect(() => {
		if (!authLoading && user && hasWorkerManagementAccess()) {
			loadWorkers();
			loadBranches();
		}
	}, [user, hasWorkerManagementAccess, filters, selectedBranchId, authLoading]);

	// Cleanup subscriptions on unmount
	useEffect(() => {
		return () => {
			workerSubscriptions.current.forEach((unsubscribe) => unsubscribe());
			workerSubscriptions.current.clear();
		};
	}, []);

	const loadWorkers = async () => {
		try {
			setLoading(true);

			// Apply branch filtering based on selected branch for admins
			const workerFilters = { ...filters };
			if (user?.isAdmin) {
				// For admins, use the selected branch filter
				if (selectedBranchId) {
					workerFilters.branchId = selectedBranchId;
				}
			} else {
				// Non-admin users can only see workers from their accessible branches
				const accessibleBranches = getAccessibleBranches();
				if (accessibleBranches.length > 0) {
					workerFilters.branchId = accessibleBranches[0]; // For now, filter by first branch
				}
			}

			const workersData = await workerService.listWorkers(workerFilters);
			setWorkers(workersData);
			setError(null);
			console.log(
				`📋 Initial load: ${workersData.length} workers loaded from workerService`
			);

			// Set up real-time subscriptions
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
		setFilters(newFilters);
	};

	const handleBranchChange = (branchId: string) => {
		setSelectedBranchId(branchId);
		// Clear any existing filters when changing branch
		setFilters({});
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

	// Sort workers
	const sortedWorkers = React.useMemo(() => {
		return [...workers].sort((a, b) => {
			const aValue = a[sortConfig.column as keyof Worker] as String;
			const bValue = b[sortConfig.column as keyof Worker] as String;

			if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
			if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [workers, sortConfig]);

	// Show loading state while auth is loading
	if (authLoading) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center'>
					<LoadingSpinner size="md" />
					<p className='text-[var(--secondary)]'>Loading...</p>
				</div>
			</div>
		);
	}

	// Show access denied only after auth loading is complete
	if (!user || !hasWorkerManagementAccess()) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center'>
					<h2 className='text-xl font-semibold text-gray-700 mb-2'>
						Access Denied
					</h2>
					<p className='text-gray-500'>
						You don&apos;t have permission to access worker management.
					</p>
				</div>
			</div>
		);
	}

	if (error && !hasWorkerManagementAccess()) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center'>
					<h2 className='text-xl font-semibold text-[var(--error)] mb-2'>Error</h2>
					<p className='text-[var(--error)]'>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full'>
			<TopBar />

			{/* Header */}
			<div className='px-6 py-4 border-b border-[var(--secondary)]/20'>
				<div className='flex items-center justify-between'>
					<div>
						<h2 className='text-2xl font-bold text-[var(--secondary)] mb-1'>
							Users Management
						</h2>
						<p className='text-sm text-[var(--secondary)]/70'>
							Manage users, track time, and assign roles across branches
						</p>
					</div>

					<div className='flex items-center gap-4'>
						{/* Branch Selector - Only show for admins */}
						{user?.isAdmin && (
							<div className='min-w-48'>
								<DropdownField
									options={branches.map((branch) => branch.name)}
									hasAllOptionsVisible={true}
									defaultValue="ALL BRANCHES"
									allSuffix="BRANCHES"
									dropdownPosition='bottom-right'
									dropdownOffset={{ top: 2, right: 0 }}
									onChange={(selectedName: string) => {
										const selectedBranch = branches.find(
											(branch) => branch.name === selectedName
										);
										handleBranchChange(selectedBranch?.id || "");
									}}
									roundness={"[12px]"}
									height={42}
									valueAlignment={"left"}
									padding=''
									shadow={true}
								/>
							</div>
						)}

						{/* Add Worker Button - only show in workers view */}
						{viewMode === "workers" && (
							<button
								onClick={handleCreateWorker}
								className='bg-[var(--accent)] text-[var(--secondary)] text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95'>
								<div className='flex flex-row items-center gap-2 text-[var(--primary)] text-shadow-md font-black text-[14px]'>
									<div className='size-4'>
										<PlusIcon className='drop-shadow-lg' />
									</div>
									<span className='mt-[2px]'>ADD WORKER</span>
								</div>
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Filters - only show in workers view */}
			{viewMode === "workers" && (
				<div className='px-6 py-4 border-b border-[var(--secondary)]/20 bg-[var(--secondary)]/5'>
					<WorkerFiltersComponent
						filters={filters}
						branches={branches}
						onFiltersChange={handleFiltersChange}
						userAccessibleBranches={getAccessibleBranches()}
						isAdmin={user?.isAdmin || false}
						hideBranchFilter={user?.isAdmin || false}
					/>
				</div>
			)}

			{/* Content */}
			<div className='flex-1 overflow-auto px-6 py-4'>
				{loading ? (
					<div className='flex items-center justify-center h-64'>
						<LoadingSpinner size='md' />
						<span className='ml-3 text-[var(--secondary)]'>
							Loading workers...
						</span>
					</div>
				) : error ? (
					<div className='text-center py-12'>
						<h3 className='text-lg font-semibold text-gray-700 mb-2'>
							Error Loading Workers
						</h3>
						<p className='text-gray-500'>{error}</p>
						<button
							onClick={loadWorkers}
							className='mt-4 px-4 py-2 bg-[var(--accent)] text-[var(--primary)] rounded-lg hover:bg-[var(--accent)]/90'>
							Retry
						</button>
					</div>
				) : viewMode === "workers" ? (
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
							Showing {sortedWorkers.length} worker
							{sortedWorkers.length !== 1 ? "s" : ""}
						</div>
					</>
				) : viewMode === "analytics" ? (
					/* Analytics View */
					<AdvancedReporting workers={workers} />
				) : (
					/* Schedule Management View */
					<WorkScheduleManagement workers={workers} />
				)}
			</div>

			{/* Modals */}
			<CreateWorkerModal
				isOpen={isCreateModalOpen}
				onClose={handleModalClose}
				onSuccess={handleWorkerCreated}
				branches={branches}
				userAccessibleBranches={
					user?.isAdmin
						? selectedBranchId
							? [selectedBranchId]
							: []
						: getAccessibleBranches()
				}
				isAdmin={user?.isAdmin || false}
				defaultBranchId={selectedBranchId}
			/>

			<EditWorkerModal
				isOpen={isEditModalOpen}
				worker={selectedWorker}
				onClose={handleModalClose}
				onSuccess={handleWorkerUpdated}
				branches={branches}
				userAccessibleBranches={
					user?.isAdmin
						? selectedBranchId
							? [selectedBranchId]
							: []
						: getAccessibleBranches()
				}
				isAdmin={user?.isAdmin || false}
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
				branches={branches}
				onClose={handleModalClose}
				onSuccess={handleWorkerUpdated}
			/>

			<AssignBranchModal
				isOpen={isAssignBranchModalOpen}
				worker={selectedWorker}
				branches={branches}
				userAccessibleBranches={
					user?.isAdmin
						? selectedBranchId
							? [selectedBranchId]
							: []
						: getAccessibleBranches()
				}
				isAdmin={user?.isAdmin || false}
				onClose={handleModalClose}
				onSuccess={handleWorkerUpdated}
			/>

			<WorkerDetailModal
				isOpen={isWorkerDetailModalOpen}
				worker={selectedWorker}
				onClose={handleModalClose}
			/>
		</div>
	);
}
