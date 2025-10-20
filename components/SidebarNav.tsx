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

// Import icons for new sections (create if they don't exist)
interface NavItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	adminOnly?: boolean;
	managerOnly?: boolean;
}

export default function SidebarNav() {
	const { logout, isUserAdmin, getUserRoleForBranch } = useAuth();
	const { currentBranch, clearCurrentBranch } = useBranch();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const router = useRouter();

	const pathname = usePathname();

	// Check if user is manager for current branch
	const isManagerForCurrentBranch = currentBranch
		? getUserRoleForBranch(currentBranch.id) === "manager"
		: false;

	// For admins, only show admin section if no branch is selected
	const shouldShowWorkerSection = !isUserAdmin() || currentBranch;
	const shouldShowManagerSection =
		(!isUserAdmin() && (isManagerForCurrentBranch || isUserAdmin())) ||
		(isUserAdmin() && currentBranch);

	// Worker Section - Available to all users (workers, managers, admins)
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
	];

	// Manager Section - Available to managers and admins
	const managerNavItems: NavItem[] = [
		{
			href: "management",
			label: "Management",
			icon: ManagementIcon,
			managerOnly: true,
		},
		{
			href: "sales",
			label: "Sales",
			icon: SalesIcon,
			managerOnly: true,
		},
		{
			href: "discounts",
			label: "Discounts",
			icon: DiscountsIcon,
			managerOnly: true,
		},
		{
			href: "logs",
			label: "Logs",
			icon: LogsIcon,
			managerOnly: true,
		},
		{
			href: "settings",
			label: "Settings",
			icon: SettingsIcon,
			managerOnly: true,
		},
	];

	// Admin Section - Available to admins only
	const adminNavItems: NavItem[] = [
		{
			href: "/admin/branches",
			label: "Branches",
			icon: BranchesIcon,
			adminOnly: true,
		},
		{
			href: "/admin/users",
			label: "Users",
			icon: UsersIcon, // You may want to create a specific worker management icon
			adminOnly: true,
		},
	];

	const renderNavItem = (item: NavItem, isAdminItem = false) => {
		const IconComponent = item.icon;
		const isActive = isAdminItem
			? isAdminRouteActive(item.href)
			: isRouteActive(item.href);
		const href = isAdminItem ? item.href : getBranchAwareHref(item.href);

		return (
			<li key={item.href}>
				<Link
					href={href}
					className={`flex h-10 items-center text-[14px] font-semibold ${
						isActive
							? "bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary)] text-shadow-lg"
							: "bg-[var(--primary)] hover:bg-[var(--accent)]/50 text-[var(--secondary)]"
					}`}>
					<div className='w-full flex items-center justify-start'>
						<IconComponent
							className={`w-8 h-8 mx-3 gap-3 ${
								isActive
									? "text-[var(--primary)] drop-shadow-lg"
									: "text-[var(--secondary)]"
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

	// Helper function to check if admin route is active
	const isAdminRouteActive = (page: string) => {
		return pathname === page;
	};

	return (
		// Sidebar container
		<div className='h-full w-[271px] bg-[var(--primary)] border-r border-gray-200 shadow-xl xl:shadow-none duration-400'>
			<div className='flex flex-col h-full'>
				{/* Logo */}
				<div className='flex items-center justify-center border-b border-gray-200 bg-[var(--accent)] h-[90px] px-6'>
					<HorizontalLogo className='w-auto opacity-100 transition-all' />
				</div>

				{/* Back to Admin Button - Show for admins when they're in a branch */}
				{isUserAdmin() && currentBranch && (
					<div className='px-3 py-2 border-b border-gray-200'>
						<button
							onClick={() => {
								clearCurrentBranch();
								router.push("/admin/branches");
							}}
							className='w-full flex items-center justify-start text-sm text-[var(--secondary)]/70 hover:text-[var(--secondary)] transition-colors'>
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
								Back to Admin
							</span>
						</button>
					</div>
				)}

				{/* Navigation */}
				<nav className='flex-1 py-[8px]'>
					<ul className='space-y-[2px]'>
						{/* Worker Section - Show for non-admins or admins with selected branch */}
						{shouldShowWorkerSection && (
							<>
								<li>
									<div className='px-3 py-2 text-xs font-bold text-[var(--secondary)]/60 uppercase tracking-wider'>
										<span className='w-auto opacity-100 transition-all duration-300'>
											Worker
										</span>
									</div>
								</li>
								{workerNavItems.map((item) => renderNavItem(item))}
							</>
						)}

						{/* Manager Section - Visible to managers and admins with selected branch */}
						{shouldShowManagerSection && (
							<>
								<li className='pt-4'>
									<div className='px-3 py-2 text-xs font-bold text-[var(--secondary)]/60 uppercase tracking-wider'>
										<span className='w-auto opacity-100 transition-all duration-300'>
											Manager
										</span>
									</div>
								</li>
								{managerNavItems.map((item) => renderNavItem(item))}
							</>
						)}

						{/* Admin Section - Visible to admins only */}
						{isUserAdmin() && (
							<>
								<li className='pt-4'>
									<div className='px-3 py-2 text-xs font-bold text-[var(--secondary)]/60 uppercase tracking-wider'>
										<span className='w-auto opacity-100 transition-all duration-300'>
											Admin
										</span>
									</div>
								</li>
								{adminNavItems.map((item) => renderNavItem(item, true))}
							</>
						)}

						{/* Logout Button */}
						<li className='pt-4'>
							<button
								onClick={handleLogout}
								disabled={isLoggingOut}
								className='group flex w-full h-10 items-center text-[14px] text-[var(--error)] hover:text-[var(--primary)] font-semibold bg-[var(--primary)] hover:bg-[var(--error)] cursor-pointer transition-colors duration-100'>
								<div className='w-full flex items-center justify-start transition-all duration-100'>
									<span className='size-8 mx-3'>
										<LogoutIcon className='gap-3 text-[var(--error)] group-hover:text-[var(--primary)]' />
									</span>
									<span className='w-0 visible lg:w-auto opacity-100 transition-all duration-100 '>
										{"Logout"}
									</span>
								</div>
							</button>
						</li>
					</ul>
				</nav>
			</div>
		</div>
	);
}
