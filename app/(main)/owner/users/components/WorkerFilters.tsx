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
	isOwner: boolean;
	onFiltersChange: (filters: WorkerFiltersType) => void;
	hideBranchFilter?: boolean; // Hide branch filter for managers
	hideOwnerRole?: boolean; // Hide owner role option for managers
}

export default function WorkerFilters({
	filters,
	branches,
	userAccessibleBranches,
	isOwner,
	onFiltersChange,
	hideBranchFilter = false,
	hideOwnerRole = false,
}: WorkerFiltersProps) {
	const [localFilters, setLocalFilters] = useState<WorkerFiltersType>(filters);

	// Filter branches based on user access
	const availableBranches = isOwner
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
		if (filters.excludeOwners) {
			clearedFilters.excludeOwners = filters.excludeOwners;
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
		<div className='flex flex-col lg:flex-row lg:items-center gap-4'>
			{/* Search Bar - Full width on mobile/tablet, flex-1 on PC */}
			<div className='w-full lg:flex-1 lg:min-w-64'>
				<div className='relative'>
					<input
						type='text'
						value={localFilters.searchQuery || ""}
						onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
						placeholder='Search workers by name, email, or ID...'
						className={`w-full text-3 px-4 py-3 pr-12 shadow-md bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
							localFilters.searchQuery ? "animate-pulse transition-all" : ""
						}`}
					/>
					<div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
						{localFilters.searchQuery ? (
							<div className='size-7.5 border-accent border-2 border-dashed rounded-full flex items-center justify-center animate-spin'></div>
						) : (
							<div className='size-7.5 bg-(--light-accent) rounded-full flex items-center justify-center'>
								<SearchIcon className='mr-0.5 mb-0.5 text-accent' />
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Filters Row - 2 columns on mobile, horizontal on larger screens */}
			<div className='flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap sm:items-center gap-4'>
				<div className='grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap gap-4'>
					{/* Branch Filter */}
					{!hideBranchFilter && availableBranches.length > 0 && (
						<div className='sm:min-w-48'>
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
					<div className='sm:min-w-36'>
						<DropdownField
							options={!hideOwnerRole ? ["Owner", "Manager", "Worker"] : ["Manager", "Worker"]}
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
							roundness={"xl"}
							height={42}
							valueAlignment={"left"}
							padding=''
							shadow={true}
						/>
					</div>

					{/* Status Filter */}
					<div className='sm:min-w-36'>
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
							roundness={"xl"}
							height={42}
							valueAlignment={"left"}
							padding=''
							shadow={true}
						/>
					</div>
				</div>

				{/* Clear Filters */}
				{hasActiveFilters && (
					<button
						onClick={clearFilters}
						className='w-full h-10.5 sm:w-auto shadow-md px-3 py-2 text-xs text-primary hover:text-primary bg-(--error)/50 hover:bg-(--error) rounded-lg transition-colors'>
						Clear
					</button>
				)}
			</div>
		</div>
	);
}
