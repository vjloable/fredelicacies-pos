"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import LogoIcon from "@/app/(main)/store/icons/LogoIcon";
import { useAdminDrawer } from "./AdminDrawerProvider";

export default function AdminSidebar() {
	const pathname = usePathname();
	const isBranches =
		pathname === "/branches" || pathname.startsWith("/branches");
	const { isOpen } = useAdminDrawer();

	const asideWidthClass = isOpen ? "max-w-[80px] lg:max-w-[260px]" : "max-w-0";
	const labelClass = isOpen
		? "max-w-[160px] opacity-100 pr-2 transition-all duration-300 ease-in-out"
		: "max-w-0 opacity-0 pr-0 overflow-hidden transition-all duration-300 ease-in-out";

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

				<nav className='flex-1 py-4'>
					<ul className='space-y-2 px-2'>
						<li>
							<Link
								href='/branches'
								className={`flex h-12 items-center rounded-lg px-3 text-[14px] font-semibold transition-colors duration-200 ${
									isBranches
										? "bg-[var(--accent)] text-[var(--primary)]"
										: "bg-[var(--primary)] text-[var(--secondary)] hover:bg-[var(--accent)]/50"
								}`}>
								<span className='w-full flex items-center gap-3 justify-center lg:justify-start'>
									<svg
										className={`w-6 h-6 ${
											isBranches
												? "text-[var(--primary)]"
												: "text-[var(--secondary)]"
										}`}
										viewBox='0 0 24 24'
										fill='none'
										xmlns='http://www.w3.org/2000/svg'>
										<path
											d='M3 13h8V3H3v10zM3 21h8v-6H3v6zM13 21h8V11h-8v10zM13 3v6h8V3h-8z'
											stroke='currentColor'
											strokeWidth='1.2'
											strokeLinecap='round'
											strokeLinejoin='round'
										/>
									</svg>

									<span
										className={`${labelClass} overflow-hidden whitespace-nowrap`}>
										Branches
									</span>
								</span>
							</Link>
						</li>
					</ul>
				</nav>
			</div>
		</aside>
	);
}
