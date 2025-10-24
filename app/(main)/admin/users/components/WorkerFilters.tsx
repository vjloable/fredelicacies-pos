import React, { useState } from "react";
import { Branch } from "@/services/branchService";
import {
	WorkerFilters as WorkerFiltersType,
	UserRole,
} from "@/types/WorkerTypes";
import SearchIcon from "@/app/(main)/[branchId]/(worker)/store/icons/SearchIcon";
import DropdownField from "@/components/DropdownField";

interface WorkerFiltersProps {
	filters: WorkerFiltersType;
	branches: Branch[];
	userAccessibleBranches: string[];
	isAdmin: boolean;
	onFiltersChange: (filters: WorkerFiltersType) => void;
	hideBranchFilter?: boolean; // Hide branch filter for managers
	hideAdminRole?: boolean; // Hide admin role option for managers
}

export default function WorkerFilters({
	filters,
	branches,
	userAccessibleBranches,
	isAdmin,
	onFiltersChange,
	hideBranchFilter = false,
	hideAdminRole = false,
}: WorkerFiltersProps) {
	const [localFilters, setLocalFilters] = useState<WorkerFiltersType>(filters);

	// Filter branches based on user access
	const availableBranches = isAdmin
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	const handleFilterChange = (key: keyof WorkerFiltersType, value: WorkerFiltersType[keyof WorkerFiltersType]) => {
		const newFilters = { ...localFilters, [key]: value };
		setLocalFilters(newFilters);
		onFiltersChange(newFilters);
	};

	const clearFilters = () => {
		const clearedFilters: WorkerFiltersType = {};

		// Preserve branchId and excludeAdmins if they were set initially
		if (filters.branchId) {
			clearedFilters.branchId = filters.branchId;
		}
		if (filters.excludeAdmins) {
			clearedFilters.excludeAdmins = filters.excludeAdmins;
		}

		setLocalFilters(clearedFilters);
		onFiltersChange(clearedFilters);
	};

	const hasActiveFilters = Object.keys(localFilters).some(
		(key) =>
			localFilters[key as keyof WorkerFiltersType] !== undefined &&
			localFilters[key as keyof WorkerFiltersType] !== ""
	);

	return (
		<div className='flex flex-wrap items-center gap-4'>
			{/* Search */}
			<div className='flex-1 min-w-64'>
				<div className='relative'>
					<input
						type='text'
						value={localFilters.searchQuery || ""}
						onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
						placeholder='Search workers by name, email, or ID...'
						className={`w-full text-[12px] px-4 py-3 pr-12 shadow-md bg-white rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent ${
							localFilters.searchQuery ? "animate-pulse transition-all" : ""
						}`}
					/>
					<div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
						{localFilters.searchQuery ? (
							<div className='size-[30px] border-[var(--accent)] border-y-2 rounded-full flex items-center justify-center animate-spin'></div>
						) : (
							<div className='size-[30px] bg-[var(--light-accent)] rounded-full flex items-center justify-center'>
								<SearchIcon className='mr-[2px] mb-[2px]' />
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Branch Filter */}
			{!hideBranchFilter && availableBranches.length > 0 && (
				<div className='min-w-48'>
					<DropdownField
						options={availableBranches.map((branch) => branch.id)}
						defaultValue='TAKE OUT'
						dropdownPosition='bottom-right'
						dropdownOffset={{ top: 2, right: 0 }}
						onChange={(e) =>
							handleFilterChange("branchId", e || undefined)
						}
						roundness={"12px"}
						height={42}
						valueAlignment={"left"}
						padding=''
						shadow={true}
					/>
				</div>
			)}

			{/* Role Filter */}
			<div className='min-w-36'>
				<DropdownField
					options={!hideAdminRole ? ["Admin", "Manager", "Worker"] : ["Manager", "Worker"]}
					defaultValue="ALL ROLES"
					allSuffix="ROLES"
					hasAllOptionsVisible={true}
					dropdownPosition='bottom-right'
					dropdownOffset={{ top: 2, right: 0 }}
					onChange={(e) =>
						handleFilterChange(
							"role",
							(e as UserRole) || undefined
						)
					}
					roundness={"[12px]"}
					height={42}
					valueAlignment={"left"}
					padding=''
					shadow={true}
				/>
			</div>

			{/* Status Filter */}
			<div className='min-w-36'>
				<DropdownField
					options={["Clocked In", "Clocked Out"]}
					defaultValue="ALL STATUS"
					allSuffix="STATUS"
					hasAllOptionsVisible={true}
					dropdownPosition='bottom-right'
					dropdownOffset={{ top: 2, right: 0 }}
					onChange={(e) =>
						handleFilterChange("status", e || undefined)
					}
					roundness={"[12px]"}
					height={42}
					valueAlignment={"left"}
					padding=''
					shadow={true}
				/>
			</div>

			{/* Clear Filters */}
			{hasActiveFilters && (
				<button
					onClick={clearFilters}
					className='px-3 py-2 text-sm text-[var(--secondary)] hover:text-[var(--secondary)]/80 bg-[var(--light-accent)] hover:bg-[var(--accent)]/40 rounded-lg transition-colors'>
					Clear
				</button>
			)}
		</div>
	);
}
