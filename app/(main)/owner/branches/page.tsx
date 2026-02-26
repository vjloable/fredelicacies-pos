"use client";

import React, { useState, useEffect } from "react";
import BranchCard from "./components/BranchCard";
import AddBranchModal from "./components/AddBranchModal";
import EditBranchModal from "./components/EditBranchModal";
import ViewBranchModal from "./components/ViewBranchModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import { useAuth } from "@/contexts/AuthContext";
import { branchService, Branch } from "@/services/branchService";
import { useRouter } from "next/navigation";
import PlusIcon from "@/components/icons/PlusIcon";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import BranchesIcon from "@/components/icons/SidebarNav/BranchesIcon";
import LoadingSpinner from "@/components/LoadingSpinner";

function formatDate(date: Date) {
	return (
		date.toLocaleDateString() +
		" " +
		date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
	);
}

export default function BranchesPage() {
	const { user, isUserOwner } = useAuth();
	const router = useRouter();
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isViewModalOpen, setIsViewModalOpen] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
	const [modalError, setModalError] = useState<string | null>(null);

	// Redirect non-owner users
	useEffect(() => {
		if (user && !isUserOwner()) {
			// Redirect to user's first assigned branch
			const assignedBranches = user.roleAssignments;
			if (assignedBranches.length > 0) {
				router.push(`/${assignedBranches[0].branchId}/store`);
			} else {
				router.push("/login");
			}
		}
	}, [user, isUserOwner, router]);

	// Load branches data
	useEffect(() => {
		const loadBranches = async () => {
			if (!user || !isUserOwner()) return;

			try {
				setLoading(true);
				setError(null);
				const { branches: branchesData, error: branchError } = await branchService.getAllBranches();
				if (branchError) throw branchError;
				setBranches(branchesData);
			} catch (err) {
				console.error("Error loading branches:", err);
				setError("Failed to load branches");
			} finally {
				setLoading(false);
			}
		};

		loadBranches();
	}, [user, isUserOwner]);

	useEffect(() => {
		if (!user || !isUserOwner()) return;

		const unsubscribe = branchService.subscribeToBranches((branches: Branch[]) => {
			setBranches(branches);
		});

		return unsubscribe; // Cleanup on unmount
	}, [user, isUserOwner]);

	// Don't render for non-owner users (will redirect)
	if (!user || !isUserOwner()) {
		return (
			<div className='flex items-center justify-center h-full'>
				
				<LoadingSpinner size="md"></LoadingSpinner>
				<span className='ml-3 text-secondary'>Redirecting...</span>
			</div>
		);
	}

	const handleBranchClick = (branchId: string) => {
		// Navigate to the branch's store page
		router.push(`/${branchId}/store`);
	};

	const handleAddBranch = () => {
		setModalError(null);
		setIsAddModalOpen(true);
	};

	const handleBranchCreated = async () => {
		// Refresh the branches list
		try {
			setLoading(true);
			const { branches: branchesData, error: branchError } = await branchService.getAllBranches();
			if (branchError) throw branchError;
			setBranches(branchesData);
		} catch (err) {
			console.error("Error refreshing branches:", err);
			setError("Failed to refresh branches");
		} finally {
			setLoading(false);
		}
	};

	const handleModalError = (errorMessage: string) => {
		setModalError(errorMessage);
	};

	const handleViewBranch = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		if (branch) {
			setSelectedBranch(branch);
			setModalError(null);
			setIsViewModalOpen(true);
		}
	};

	const handleEditBranch = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		if (branch) {
			setSelectedBranch(branch);
			setModalError(null);
			setIsEditModalOpen(true);
		}
	};

	const handleDeleteBranch = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		if (branch) {
			setSelectedBranch(branch);
			setModalError(null);
			setIsDeleteModalOpen(true);
		}
	};

	const handleCloseAllModals = () => {
		setIsAddModalOpen(false);
		setIsEditModalOpen(false);
		setIsViewModalOpen(false);
		setIsDeleteModalOpen(false);
		setSelectedBranch(null);
		setModalError(null);
	};

	const handleViewToEdit = () => {
		setIsViewModalOpen(false);
		setIsEditModalOpen(true);
	};

	const handleViewToDelete = () => {
		setIsViewModalOpen(false);
		setIsDeleteModalOpen(true);
	};

	return (
		<div className='flex flex-col h-full'>
			{/* Desktop TopBar */}
			<div className='hidden sm:block'>
				<TopBar
					title="Branch Management"
					icon={<BranchesIcon className="mr-2" />}
					showTimeTracking={false}
				/>
			</div>

			{/* Mobile TopBar */}
			<div className='block sm:hidden'>
				<MobileTopBar
					title="Branch Management"
					icon={<BranchesIcon className="mr-2" />}
					showTimeTracking={false}
				/>
			</div>

			<div className='px-6 py-4 border-b border-gray-200 sm:hidden'>
				<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
					<button
						onClick={handleAddBranch}
						className='w-full sm:w-auto bg-accent text-secondary text-3 px-4 py-2 rounded-lg hover:bg-(--accent)/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95'>
						<div className='flex flex-row items-center justify-center gap-2 text-primary text-shadow-md font-black text-3.5'>
							<div className='size-4'>
								<PlusIcon className='drop-shadow-lg' />
							</div>
							<span className='mt-0.5'>ADD BRANCH</span>
						</div>
					</button>
				</div>
			</div>

			{/* Desktop Header with Add Button */}
			<div className='hidden sm:block px-6 py-4 border-b border-gray-200'>
				<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
					<div className="flex-col">
						<p className='text-sm text-(--secondary)/70'>
							Manage your business locations and settings
						</p>
					</div>
					<button
						onClick={handleAddBranch}
						className='w-full sm:w-auto bg-accent text-secondary text-3 px-4 py-2 rounded-lg hover:bg-(--accent)/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95'>
						<div className='flex flex-row items-center justify-center gap-2 text-primary text-shadow-md font-black text-3.5'>
							<div className='size-4'>
								<PlusIcon className='drop-shadow-lg' />
							</div>
							<span className='mt-0.5'>ADD BRANCH</span>
						</div>
					</button>
				</div>
			</div>

			<div className='p-6'>
				{loading && (
					<div className='flex items-center justify-center py-8'>
						<LoadingSpinner size="md"/>
						<span className='ml-3 text-secondary'>
							Loading branches...
						</span>
					</div>
				)}

				{error && (
					<div className='bg-(--error)/10 border border-(--error)/40 rounded-lg p-4 mb-4'>
						<div className='flex items-center gap-3'>
							<svg
								className='w-5 h-5 text-(--error)'
								fill='currentColor'
								viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clipRule='evenodd'
								/>
							</svg>
							<span className='text-(--error) font-medium'>{error}</span>
						</div>
					</div>
				)}

				{modalError && (
					<div className='bg-(--error)/10 border border-(--error)/40 rounded-lg p-4 mb-4'>
						<div className='flex items-center gap-3'>
							<svg
								className='w-5 h-5 text-(--error)'
								fill='currentColor'
								viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clipRule='evenodd'
								/>
							</svg>
							<span className='text-(--error) font-medium'>
								{modalError}
							</span>
						</div>
					</div>
				)}

				{!loading && !error && branches.length === 0 && (
					<div className='text-center py-12'>
						<div className='w-16 h-16 bg-(--light-accent) rounded-full flex items-center justify-center mx-auto mb-4'>
							<BranchesIcon className="text-accent" />
						</div>
						<h3 className='text-lg font-medium text-secondary mb-2'>
							No Branches Found
						</h3>
						<p className='text-(--secondary)/70'>
							No branches have been created yet.
						</p>
					</div>
				)}

				{!loading && !error && branches.length > 0 && (
					<>
						<div className='mb-4 flex items-center justify-between'>
							<div>
								<h3 className='text-lg font-semibold text-secondary'>
									All Branches <span className='ml-2 text-primary text-xs bg-accent w-1 h-1 rounded-full px-2 py-0.5'>{branches.length}</span>
								</h3>
								<p className='text-sm text-(--secondary)/70'>
									Click on a branch to navigate to its management interface
								</p>
							</div>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
							{branches.map((branch) => (
								<BranchCard
									key={branch.id}
									branch={{
										branchId: branch.id,
										name: branch.name,
									location: branch.address || 'No address',
									createdAt: new Date(branch.created_at),
									updatedAt: new Date(branch.updated_at),
									isActive: branch.status === 'active',
									imgUrl: branch.logo_url || '', // Default image
									}}
									formatDate={formatDate}
									onClick={handleBranchClick}
									onView={handleViewBranch}
									onEdit={handleEditBranch}
									onDelete={handleDeleteBranch}
								/>
							))}
						</div>
					</>
				)}
			</div>

			{/* Add Branch Modal */}
			<AddBranchModal
				isOpen={isAddModalOpen}
				onClose={handleCloseAllModals}
				onSuccess={handleBranchCreated}
				onError={handleModalError}
			/>

			{/* Edit Branch Modal */}
			<EditBranchModal
				isOpen={isEditModalOpen}
				branch={selectedBranch}
				onClose={handleCloseAllModals}
				onSuccess={handleBranchCreated}
				onError={handleModalError}
			/>

			{/* View Branch Modal */}
			<ViewBranchModal
				isOpen={isViewModalOpen}
				branch={selectedBranch}
				onClose={handleCloseAllModals}
				onEdit={handleViewToEdit}
				onDelete={handleViewToDelete}
			/>

			{/* Delete Confirmation Modal */}
			<DeleteConfirmationModal
				isOpen={isDeleteModalOpen}
				branch={selectedBranch}
				onClose={handleCloseAllModals}
				onSuccess={handleBranchCreated}
				onError={handleModalError}
			/>
		</div>
	);
}
