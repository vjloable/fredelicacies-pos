import StoreIcon from "@/components/icons/SidebarNav/StoreIcon";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import SettingsIcon from "./icons/SidebarNav/SettingsIcon";
import LogoutIcon from "./icons/SidebarNav/LogoutIcon";
import DiscountsIcon from "./icons/SidebarNav/DiscountsIcon";
import BranchesIcon from "./icons/SidebarNav/BranchesIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useState } from "react";
import ManagementIcon from "./icons/SidebarNav/ManagementIcon";
import UsersIcon from "./icons/SidebarNav/UsersIcon";
import VersionDisplay from "./VersionDisplay";

// Import icons for new sections (create if they don't exist)
interface NavItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	ownerOnly?: boolean;
	managerOnly?: boolean;
}

export default function SidebarNav() {
	const { logout, isUserOwner, getUserRoleForBranch } = useAuth();
	const { currentBranch, clearCurrentBranch } = useBranch();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const router = useRouter();

	const pathname = usePathname();

	// Check if user is manager for current branch
	const isManagerForCurrentBranch = currentBranch
		? getUserRoleForBranch(currentBranch.id) === "manager"
		: false;

	// For owners, only show owner section if no branch is selected
	const shouldShowWorkerSection = !isUserOwner() || currentBranch;
	const shouldShowManagerSection =
		(!isUserOwner() && (isManagerForCurrentBranch || isUserOwner())) ||
		(isUserOwner() && currentBranch);

	// Worker Section - Available to all users (workers, managers, owners)
	const workerNavItems: NavItem[] = [
		{
			href: "store",
			label: "Store",
			icon: StoreIcon,
		},
		{
			href: "inventory",
			label: "Inventory",
			icon: InventoryIcon,
		},
		{
			href: "sales",
			label: "Sales",
			icon: SalesIcon,
		},
	];

	// Manager Section - Available to managers and owners
	const managerNavItems: NavItem[] = [
		{
			href: "management",
			label: "Management",
			icon: ManagementIcon,
			managerOnly: true,
		},
		{
			href: "discounts",
			label: "Discounts",
			icon: DiscountsIcon,
			managerOnly: true,
		},
		{
			href: "settings",
			label: "Settings",
			icon: SettingsIcon,
			managerOnly: true,
		},
	];

	// Owner Section - Available to owners only
	const ownerNavItems: NavItem[] = [
		{
			href: "/owner/branches",
			label: "Branches",
			icon: BranchesIcon,
			ownerOnly: true,
		},
		{
			href: "/owner/users",
			label: "Users",
			icon: UsersIcon,
			ownerOnly: true,
		},
		{
			href: "/owner/logs",
			label: "Logs",
			icon: LogsIcon,
			ownerOnly: true,
		},
	];

	const renderNavItem = (item: NavItem, isOwnerItem = false) => {
		const IconComponent = item.icon;
		const isActive = isOwnerItem
			? isOwnerRouteActive(item.href)
			: isRouteActive(item.href);
		const href = isOwnerItem ? item.href : getBranchAwareHref(item.href);

		return (
			<li key={item.href}>
				<Link
					href={href}
					className={`flex h-10 items-center text-3.5 font-semibold ${
						isActive
							? "bg-accent hover:bg-(--accent)/80 text-primary text-shadow-lg"
							: "bg-primary hover:bg-(--accent)/50 text-secondary"
					}`}>
					<div className='w-full flex items-center justify-start'>
						<IconComponent
							className={`w-8 h-8 mx-3 gap-3 ${
								isActive
									? "text-primary drop-shadow-lg"
									: "text-secondary"
							} transition-all duration-300`}
						/>
						<span className='w-auto opacity-100 transition-all duration-300'>
							{item.label}
						</span>
					</div>
				</Link>
			</li>
		);
	};

	const handleLogout = async () => {
		if (isLoggingOut) return;

		setIsLoggingOut(true);
		try {
			await logout();
			router.push("/login");
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			setIsLoggingOut(false);
		}
	};

	// Helper function to get the current branch-aware URL
	const getBranchAwareHref = (page: string) => {
		if (!currentBranch) return `/${page}`;
		return `/${currentBranch.id}/${page}`;
	};

	// Helper function to check if current route is active
	const isRouteActive = (page: string) => {
		if (!currentBranch) return false;
		return pathname === `/${currentBranch.id}/${page}`;
	};

	// Helper function to check if owner route is active
	const isOwnerRouteActive = (page: string) => {
		return pathname === page;
	};

	return (
		// Sidebar container
		<div className='h-full w-67.75 bg-primary border-r border-gray-200 shadow-xl xl:shadow-none duration-400'>
			<div className='flex flex-col h-full'>
				{/* Logo */}
				<div className='flex items-center justify-center border-b border-gray-200 bg-primary h-22.5 px-6'>
					<HorizontalLogo className='w-auto opacity-100 transition-all' />
				</div>

				{/* Branch Information */}
				{currentBranch && (
					<div className='px-4 py-3 border-b border-gray-200 bg-primary'>
						<div className='text-left'>
							<h3 className='text-3.5 font-bold text-secondary'>
								{currentBranch.name}
							</h3>
							<p className='text-3 text-(--secondary)/70 mt-1 leading-tight'>
								{currentBranch.address}
							</p>
						</div>
					</div>
				)}

				{/* Back to Owner Button - Show for owners when they're in a branch */}
				{isUserOwner() && currentBranch && (
					<div className='px-3 py-2 border-b border-gray-200'>
						<button
							onClick={() => {
								clearCurrentBranch();
								router.push("/owner/branches");
							}}
							className='w-full flex items-center justify-start text-sm text-(--secondary)/70 hover:text-secondary transition-colors'>
							<svg
								className='w-4 h-4 mr-2'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M10 19l-7-7m0 0l7-7m-7 7h18'
								/>
							</svg>
							<span className='w-auto opacity-100 transition-all duration-300'>
								Back to Owner
							</span>
						</button>
					</div>
				)}

				{/* Navigation */}
				<nav className='flex-1 py-2'>
					<ul className='space-y-0.5'>
						{/* Worker Section - Show for non-owners or owners with selected branch */}
						{shouldShowWorkerSection && (
							<>
								<li>
									<div className='px-3 py-2 text-xs font-bold text-(--secondary)/60 uppercase tracking-wider'>
										<span className='w-auto opacity-100 transition-all duration-300'>
											Worker
										</span>
									</div>
								</li>
								{workerNavItems.map((item) => renderNavItem(item))}
							</>
						)}

						{/* Manager Section - Visible to managers and owners with selected branch */}
						{shouldShowManagerSection && (
							<>
								<li className='pt-4'>
									<div className='px-3 py-2 text-xs font-bold text-(--secondary)/60 uppercase tracking-wider'>
										<span className='w-auto opacity-100 transition-all duration-300'>
											Manager
										</span>
									</div>
								</li>
								{managerNavItems.map((item) => renderNavItem(item))}
							</>
						)}

						{/* Owner Section - Visible to owners only */}
						{isUserOwner() && (
							<>
								<li className='pt-4'>
									<div className='px-3 py-2 text-xs font-bold text-(--secondary)/60 uppercase tracking-wider'>
										<span className='w-auto opacity-100 transition-all duration-300'>
											Owner
										</span>
									</div>
								</li>
								{ownerNavItems.map((item) => renderNavItem(item, true))}
							</>
						)}

						{/* Logout Button */}
						<li className='pt-4'>
							<button
								onClick={handleLogout}
								disabled={isLoggingOut}
								className='group flex w-full h-10 items-center text-3.5 text-(--error) hover:text-primary font-semibold bg-primary hover:bg-(--error) cursor-pointer transition-colors duration-100'>
								<div className='w-full flex items-center justify-start transition-all duration-100'>
									<span className='size-8 mx-3'>
										<LogoutIcon className='gap-3 text-(--error) group-hover:text-primary' />
									</span>
									<span className='w-0 visible lg:w-auto opacity-100 transition-all duration-100 '>
										{"Logout"}
									</span>
								</div>
							</button>
						</li>
					</ul>
				</nav>
			{/* Version */}
			<div className='px-4 py-3 border-t border-gray-200'>
				<p className='text-2.5 text-(--secondary)/30 text-center'>
					<VersionDisplay variant="simple" />
				</p>
			</div>
			</div>
		</div>
	);
}
