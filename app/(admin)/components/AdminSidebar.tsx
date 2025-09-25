"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import LogoIcon from "@/app/(main)/[branchId]/store/icons/LogoIcon";
import LogoutIcon from "@/components/icons/SidebarNav/LogoutIcon";
import { useAdminDrawer } from "./AdminDrawerProvider";
import BranchesIcon from "@/components/icons/SidebarNav/BranchesIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

export default function AdminSidebar() {
	const pathname = usePathname();
	const { logout } = useAuth();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const isBranches =
		pathname === "/branches" || pathname.startsWith("/branches");
	const { isOpen } = useAdminDrawer();

	const asideWidthClass = isOpen ? "max-w-[80px] lg:max-w-[260px]" : "max-w-0";
	
	const handleLogout = async () => {
		if (isLoggingOut) return;
		
		setIsLoggingOut(true);
		try {
			await logout();
			router.push('/login');
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			setIsLoggingOut(false);
		}
	};

	return (
		<aside
			className={`h-full w-full ${asideWidthClass} bg-[var(--primary)] border-r border-gray-200 transition-[max-width] duration-300 ease-in-out overflow-hidden`}>
			<div className='flex flex-col h-full'>
				<div className='flex items-center border-b border-gray-200 bg-[var(--accent)] h-[90px] px-6'>
					<HorizontalLogo
						className={`${
							isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
						} hidden lg:block transition-all duration-300 ease-in-out transform`}
						aria-hidden={!isOpen}
					/>

					<LogoIcon
						className={`${
							isOpen ? "hidden" : "block"
						} visible lg:invisible lg:w-0 lg:opacity-0 transition-all duration-300 ease-in-out`}
						aria-hidden={isOpen}
					/>
				</div>

				{/* Navigation */}
				<nav className="flex-1 py-[8px]">
					<ul className="space-y-[8px]">
						<li>
							<Link 
								href="/branches"
								className={`flex h-10 items-center text-[14px] font-semibold ${
									isBranches 
										? 'bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary)] text-shadow-lg'
										: 'bg-[var(--primary)] hover:bg-[var(--accent)]/50 text-[var(--secondary)]'
								}`}
							>
								<div className="w-full flex items-center justify-center lg:justify-start">
									<BranchesIcon className={`w-8 h-8 mx-3 gap-3 ${isBranches ? "text-[var(--primary)] drop-shadow-lg" : "text-[var(--secondary)]"} transition-all duration-300`} />
									<span className={`${isOpen ? "invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100" : "invisible w-0 opacity-0"} transition-all duration-300`}>Branches</span>
								</div>
							</Link>
						</li>
						<li>
							<button
								onClick={handleLogout}
								disabled={isLoggingOut}
								className="flex w-full h-10 items-center text-[14px] text-[var(--error)] hover:text-[var(--primary)] font-semibold bg-[var(--primary)] hover:bg-[var(--error)] cursor-pointer transition-colors duration-400"
							>
								<div className="w-full flex items-center justify-center lg:justify-start transition-all duration-300">
									<span className="size-8 mx-3">
										<LogoutIcon className="gap-3 text-[var(--error)]" />
									</span>
									<span className={`${isOpen ? "invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100" : "invisible w-0 opacity-0"} transition-all duration-300`}>
										Logout
									</span>
								</div>
							</button>
						</li>
					</ul>
				</nav>
			</div>
		</aside>
	);
}
