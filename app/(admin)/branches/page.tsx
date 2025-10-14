"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { branchService, Branch } from "@/services/branchService";
import AdminTopBar from "../components/AdminTopBar";
import BranchesIcon from "@/components/icons/SidebarNav/BranchesIcon";
import LoadingSpinner from "@/components/LoadingSpinner";

interface BranchCardProps {
	branch: Branch;
	onNavigate: (branchId: string) => void;
}

function BranchCard({ branch, onNavigate }: BranchCardProps) {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
			<div className="flex items-start justify-between mb-4">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						<h3 className="text-lg font-semibold text-[var(--secondary)]">{branch.name}</h3>
						<span className={`px-2 py-1 text-xs rounded-full font-medium ${
							branch.isActive 
								? 'bg-green-100 text-green-800' 
								: 'bg-red-100 text-red-800'
						}`}>
							{branch.isActive ? 'Active' : 'Inactive'}
						</span>
					</div>
					<p className="text-sm text-gray-600 mb-1">{branch.location}</p>
					<p className="text-xs text-gray-500">
						Created: {branch.createdAt.toDate().toLocaleDateString()}
					</p>
				</div>
			</div>

			<div className="flex gap-2">
				<button
					onClick={() => onNavigate(branch.id)}
					className="flex-1 px-3 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:bg-[var(--accent)]/90"
				>
					Manage Branch
				</button>
			</div>
		</div>
	);
}

export default function BranchesPage() {
	const { user, isUserAdmin } = useAuth();
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadBranches();
	}, []);

	const loadBranches = async () => {
		setLoading(true);
		try {
			const branchesData = await branchService.getAllBranches();
			setBranches(branchesData);
		} catch (error) {
			console.error("Error loading branches:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleNavigateToBranch = (branchId: string) => {
		// Navigate to branch management
		window.open(`/${branchId}/store`, '_blank');
	};

	if (!user || !isUserAdmin()) {
		return (
			<div className="flex flex-col h-full">
				<AdminTopBar title="Branch Management" />
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-red-600">Access denied. Admin privileges required.</p>
					</div>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex flex-col h-full">
				<AdminTopBar title="Branch Management" />
				<div className="flex-1 flex items-center justify-center">
					<LoadingSpinner />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<AdminTopBar title="Branch Management" />
			
			<div className="flex-1 overflow-y-auto px-6 py-6">
				<div className="max-w-7xl mx-auto space-y-8">
					{/* Stats */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-white rounded-lg border border-gray-200 p-4">
							<h3 className="text-sm font-medium text-gray-500">Total Branches</h3>
							<p className="text-2xl font-bold text-[var(--secondary)]">{branches.length}</p>
						</div>
						<div className="bg-white rounded-lg border border-gray-200 p-4">
							<h3 className="text-sm font-medium text-gray-500">Active Branches</h3>
							<p className="text-2xl font-bold text-green-600">
								{branches.filter(b => b.isActive).length}
							</p>
						</div>
						<div className="bg-white rounded-lg border border-gray-200 p-4">
							<h3 className="text-sm font-medium text-gray-500">Inactive Branches</h3>
							<p className="text-2xl font-bold text-red-600">
								{branches.filter(b => !b.isActive).length}
							</p>
						</div>
					</div>

					{/* Branches Grid */}
					{branches.length > 0 ? (
						<div>
							<h2 className="text-xl font-bold text-[var(--secondary)] mb-4">
								All Branches ({branches.length})
							</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{branches.map((branch) => (
									<BranchCard
										key={branch.id}
										branch={branch}
										onNavigate={handleNavigateToBranch}
									/>
								))}
							</div>
						</div>
					) : (
						<div className="text-center py-12">
							<BranchesIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
							<h3 className="text-lg font-medium text-gray-900 mb-2">No branches found</h3>
							<p className="text-gray-500">No branches have been created yet.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}