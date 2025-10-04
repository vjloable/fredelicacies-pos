"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workerService, Worker } from "@/services/workerService";
import { branchService, Branch } from "@/services/branchService";
import { WorkerFilters as WorkerFiltersType } from "@/types/WorkerTypes";
import AdminTopBar from "@/app/(admin)/components/AdminTopBar";
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

export default function WorkersPage() {
	const { user, hasWorkerManagementAccess, getAccessibleBranches } = useAuth();
	const [workers, setWorkers] = useState<Worker[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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
	const [viewMode, setViewMode] = useState<
		"workers" | "analytics" | "schedule"
	>("workers");

	// Filters
	const [filters, setFilters] = useState<WorkerFiltersType>({});
	const [sortConfig, setSortConfig] = useState<{
		column: string;
		direction: "asc" | "desc";
	}>({ column: "name", direction: "asc" });

	// Check access
	useEffect(() => {
		if (user && !hasWorkerManagementAccess()) {
			setError("You don't have permission to access worker management.");
			setLoading(false);
		}
	}, [user, hasWorkerManagementAccess]);

	// Load data
	useEffect(() => {
		if (user && hasWorkerManagementAccess()) {
			loadWorkers();
			loadBranches();
		}
	}, [user, hasWorkerManagementAccess, filters]);

	const loadWorkers = async () => {
		try {
			setLoading(true);

			// Apply branch filtering based on user permissions
			let workerFilters = { ...filters };
			if (!user?.isAdmin) {
				// Non-admin users can only see workers from their accessible branches
				const accessibleBranches = getAccessibleBranches();
				if (accessibleBranches.length > 0) {
					workerFilters.branchId = accessibleBranches[0]; // For now, filter by first branch
				}
			}

			const workersData = await workerService.listWorkers(workerFilters);
			setWorkers(workersData);
			setError(null);
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
			const aValue = a[sortConfig.column as keyof Worker] as any;
			const bValue = b[sortConfig.column as keyof Worker] as any;

			if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
			if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [workers, sortConfig]);

	if (!user || !hasWorkerManagementAccess()) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center'>
					<div className='text-2xl text-gray-400 mb-4'>🚫</div>
					<h2 className='text-xl font-semibold text-gray-700 mb-2'>
						Access Denied
					</h2>
					<p className='text-gray-500'>
						You don't have permission to access worker management.
					</p>
				</div>
			</div>
		);
	}

	if (error && !hasWorkerManagementAccess()) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center'>
					<div className='text-2xl text-red-400 mb-4'>⚠️</div>
					<h2 className='text-xl font-semibold text-red-700 mb-2'>Error</h2>
					<p className='text-red-500'>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full'>
			<AdminTopBar />

			{/* Header */}
			<div className='px-6 py-4 border-b border-gray-200'>
				<div className='flex items-center justify-between'>
					<div>
						<h2 className='text-2xl font-bold text-[var(--secondary)] mb-1'>
							Worker Management
						</h2>
						<p className='text-sm text-[var(--secondary)]/70'>
							Manage workers, track time, and assign roles across branches
						</p>
					</div>

					<div className='flex items-center gap-4'>
						{/* View Toggle */}
						<div className='flex bg-gray-100 rounded-lg p-1'>
							<button
								onClick={() => setViewMode("workers")}
								className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
									viewMode === "workers"
										? "bg-white text-gray-900 shadow-sm"
										: "text-gray-600 hover:text-gray-900"
								}`}>
								Workers
							</button>
							<button
								onClick={() => setViewMode("analytics")}
								className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
									viewMode === "analytics"
										? "bg-white text-gray-900 shadow-sm"
										: "text-gray-600 hover:text-gray-900"
								}`}>
								Analytics
							</button>
							{/* <button
								onClick={() => setViewMode("schedule")}
								className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
									viewMode === "schedule"
										? "bg-white text-gray-900 shadow-sm"
										: "text-gray-600 hover:text-gray-900"
								}`}>
								Schedule
							</button> */}
						</div>

						{/* Add Worker Button - only show in workers view */}
						{viewMode === "workers" && (
							<button
								onClick={handleCreateWorker}
								className='bg-[var(--accent)] text-[var(--primary)] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95 flex items-center gap-2'>
								<PlusIcon />
								Add Worker
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Filters - only show in workers view */}
			{viewMode === "workers" && (
				<div className='px-6 py-4 border-b border-gray-200 bg-gray-50'>
					<WorkerFiltersComponent
						filters={filters}
						branches={branches}
						onFiltersChange={handleFiltersChange}
						userAccessibleBranches={getAccessibleBranches()}
						isAdmin={user?.isAdmin || false}
					/>
				</div>
			)}

			{/* Content */}
			<div className='flex-1 overflow-auto px-6 py-4'>
				{loading ? (
					<div className='flex items-center justify-center h-64'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]'></div>
						<span className='ml-3 text-[var(--secondary)]'>
							Loading workers...
						</span>
					</div>
				) : error ? (
					<div className='text-center py-12'>
						<div className='text-2xl text-gray-400 mb-4'>⚠️</div>
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
				userAccessibleBranches={getAccessibleBranches()}
				isAdmin={user?.isAdmin || false}
			/>

			<EditWorkerModal
				isOpen={isEditModalOpen}
				worker={selectedWorker}
				onClose={handleModalClose}
				onSuccess={handleWorkerUpdated}
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
				userAccessibleBranches={getAccessibleBranches()}
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
