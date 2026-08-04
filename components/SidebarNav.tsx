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
import { Fragment, useEffect, useState } from "react";
import ManagementIcon from "./icons/SidebarNav/ManagementIcon";
import UsersIcon from "./icons/SidebarNav/UsersIcon";
import DistributionIcon from "./icons/SidebarNav/DistributionIcon";
import DashboardIcon from "./icons/SidebarNav/DashboardIcon";
import VersionDisplay from "./VersionDisplay";
import WhatsNewModal from "./WhatsNewModal";
import {
  getBranchTransfers,
  subscribeToBranchTransfers,
} from "@/services/transferService";

// Import icons for new sections (create if they don't exist)
interface NavItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	ownerOnly?: boolean;
	managerOnly?: boolean;
	badge?: number;
}

export default function SidebarNav() {
	const { logout, isUserOwner, hasManagerPrivileges } = useAuth();
	const { currentBranch, clearCurrentBranch } = useBranch();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [transferActionable, setTransferActionable] = useState(0);
	const [showWhatsNew, setShowWhatsNew] = useState(false);
	const router = useRouter();

	const pathname = usePathname();

	// Live count of actionable transfers for the current branch:
	//   - incoming where this branch is dest and status=sent (push OR fulfilled-pull)
	//   - outgoing pulls where this branch is source and not yet fulfilled
	useEffect(() => {
		if (!currentBranch?.id) {
			setTransferActionable(0);
			return;
		}
		const branchId = currentBranch.id;
		let cancelled = false;
		const refresh = () => {
			getBranchTransfers(branchId, { status: "sent" }).then(({ transfers }) => {
				if (cancelled) return;
				let actionable = 0;
				for (const t of transfers) {
					if (t.destination_branch_id === branchId && (t.direction === "push" || !!t.fulfilled_at)) {
						actionable++;
					} else if (
						t.source_branch_id === branchId &&
						t.direction === "pull" &&
						!t.fulfilled_at
					) {
						actionable++;
					}
				}
				setTransferActionable(actionable);
			});
		};
		refresh();
		const unsub = subscribeToBranchTransfers(branchId, refresh);
		return () => {
			cancelled = true;
			unsub();
		};
	}, [currentBranch?.id]);

	// Check if user is team leader (or higher) for current branch
	const isManagerForCurrentBranch = currentBranch
		? hasManagerPrivileges(currentBranch.id)
		: false;

	// The commissary is a production hub: inventory + distribution + dashboard, no store/sales.
	const isCommissary = currentBranch?.type === "commissary";
	const isPlainWorker = !isUserOwner() && !isManagerForCurrentBranch;

	// Outside a branch, an owner/admin is looking at cross-branch tools only — a
	// separate flat list (no functional grouping, since it's just five global pages).
	const isGlobalOwnerView = isUserOwner() && !currentBranch;

	const globalNavItems: NavItem[] = [
		{ href: "/owner/branches", label: "Branches", icon: BranchesIcon, ownerOnly: true },
		{ href: "/owner/dashboard", label: "Dashboard", icon: DashboardIcon, ownerOnly: true },
		{ href: "/owner/transfers", label: "Distribution", icon: DistributionIcon, ownerOnly: true },
		{ href: "/owner/users", label: "Users", icon: UsersIcon, ownerOnly: true },
		{ href: "/owner/logs", label: "Logs", icon: LogsIcon, ownerOnly: true },
	];

	// Operations — day-to-day selling. Store/Sales don't apply to the commissary hub.
	const operationsNavItems: NavItem[] = currentBranch && !isCommissary
		? [
			{ href: "store", label: "Store", icon: StoreIcon },
			{ href: "sales", label: "Sales", icon: SalesIcon },
			...(isManagerForCurrentBranch || isUserOwner()
				? [{ href: "discounts", label: "Discounts", icon: DiscountsIcon } as NavItem]
				: []),
		  ]
		: [];

	// Inventory & Distribution — stock and inter-branch transfers.
	const inventoryNavItems: NavItem[] = currentBranch
		? [
			{ href: "inventory", label: "Inventory", icon: InventoryIcon },
			...(!isPlainWorker || transferActionable > 0 || isCommissary
				? [{
					href: "transfers",
					label: "Distribution",
					icon: DistributionIcon,
					badge: transferActionable || undefined,
				} as NavItem]
				: []),
		  ]
		: [];

	// People — managing staff and access.
	const peopleNavItems: NavItem[] = currentBranch && (isManagerForCurrentBranch || isUserOwner())
		? [{ href: "management", label: "Management", icon: ManagementIcon } as NavItem]
		: [];

	// Insights — the commissary's own dashboard (its production overview).
	const insightsNavItems: NavItem[] = currentBranch && isCommissary
		? [{ href: "dashboard", label: "Dashboard", icon: DashboardIcon } as NavItem]
		: [];

	// System — branch setup and account settings.
	const systemNavItems: NavItem[] = currentBranch
		? [{ href: "settings", label: "Settings", icon: SettingsIcon } as NavItem]
		: [];

	const navGroups: { label: string; items: NavItem[] }[] = [
		{ label: "Operations", items: operationsNavItems },
		{ label: "Inventory", items: inventoryNavItems },
		{ label: "People", items: peopleNavItems },
		{ label: "Insights", items: insightsNavItems },
		{ label: "System", items: systemNavItems },
	];

	const renderNavItem = (item: NavItem) => {
		const isAbsolute = item.href.startsWith("/");
		const IconComponent = item.icon;
		const isActive = isAbsolute
			? isOwnerRouteActive(item.href)
			: isRouteActive(item.href);
		const href = isAbsolute ? item.href : getBranchAwareHref(item.href);

		return (
			<li key={item.href}>
				<Link
					href={href}
					className={`flex h-10 items-center text-3 font-semibold ${
						isActive
							? "bg-accent hover:bg-accent/80 text-primary text-shadow-lg"
							: "bg-primary hover:bg-accent/50 text-secondary"
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
						{item.badge !== undefined && item.badge > 0 && (
							<span className={`ml-auto mr-3 px-1.5 py-0.5 rounded-full text-2.5 font-bold tabular-nums ${
								isActive ? "bg-primary text-accent" : "bg-error text-primary"
							}`}>
								{item.badge}
							</span>
						)}
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
							<div className='flex items-center gap-1.5 flex-wrap'>
									<h3 className='text-3 font-bold text-secondary'>
										{currentBranch.name}
									</h3>
									{currentBranch.type && currentBranch.type !== 'branch' && (
										<span className='px-1.5 py-0.5 rounded-full text-2.5 font-bold bg-accent/15 text-accent capitalize'>
											{currentBranch.type}
										</span>
									)}
								</div>
								<p className='text-[12px] text-secondary/70 mt-1 leading-tight'>
									{currentBranch.address}
								</p>
						</div>
					</div>
				)}

				{/* Switch branch — takes the owner back to the branch picker */}
				{isUserOwner() && currentBranch && (
					<div className='px-3 py-2.5 border-b border-gray-200'>
						<button
							onClick={() => {
								clearCurrentBranch();
								router.push("/owner/branches");
							}}
							className='w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-primary px-3 py-2 text-3 font-semibold text-secondary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-colors'>
							<svg
								className='size-4 shrink-0'
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
								All Branches
							</span>
						</button>
					</div>
				)}

				{/* Navigation */}
				<nav className='flex-1 min-h-0 py-2 overflow-y-auto'>
					<ul className='space-y-0.5'>
						{/* Outside a branch: a flat, ordered list of cross-branch tools. Inside a
						    branch: functional groups, each rendered only if it has visible items. */}
						{isGlobalOwnerView
							? globalNavItems.map((item) => renderNavItem(item))
							: navGroups.map((group, index) =>
								group.items.length > 0 ? (
									<Fragment key={group.label}>
										<li className={index === 0 ? undefined : "pt-4"}>
											<div className='px-3 py-2 text-xs font-bold text-secondary/60 uppercase tracking-wider'>
												<span className='w-auto opacity-100 transition-all duration-300'>
													{group.label}
												</span>
											</div>
										</li>
										{group.items.map((item) => renderNavItem(item))}
									</Fragment>
								) : null
							)}

						{/* Logout Button */}
						<li className='pt-4'>
							<button
								onClick={handleLogout}
								disabled={isLoggingOut}
								className='group flex w-full h-10 items-center text-3 text-error hover:text-primary font-semibold bg-primary hover:bg-error cursor-pointer transition-colors duration-100'>
								<div className='w-full flex items-center justify-start transition-all duration-100'>
									<span className='size-8 mx-3'>
										<LogoutIcon className='gap-3 text-error group-hover:text-primary' />
									</span>
									<span className='w-0 visible lg:w-auto opacity-100 transition-all duration-100 '>
										{"Logout"}
									</span>
								</div>
							</button>
						</li>
					</ul>
				</nav>
			{/* Version + What's New */}
			<div className='shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200'>
				<div className='flex items-center justify-center gap-1.5'>
					<p className='text-2.5 text-secondary/30'>
						<VersionDisplay variant="simple" />
					</p>
					<span className='text-secondary/20'>·</span>
					<button
						onClick={() => setShowWhatsNew(true)}
						className='text-2.5 text-accent/60 hover:text-accent transition-colors'
					>
						What&apos;s New
					</button>
				</div>
			</div>

			{/* Auto-show on version change + manual re-open */}
			<WhatsNewModal
				forceOpen={showWhatsNew}
				onClose={() => setShowWhatsNew(false)}
			/>
			</div>
		</div>
	);
}
