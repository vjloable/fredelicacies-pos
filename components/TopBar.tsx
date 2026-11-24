"use client";

import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import LiveIndicator from "@/components/LiveIndicator";
import { useState } from "react";
import MenuBurgerIcon from "@/components/icons/MenuBurger";
import ProfileModal from "@/components/ProfileModal";
import SafeImage from "@/components/SafeImage";
import { useShift } from "@/contexts/ShiftContext";
import OpenShiftModal from "@/components/shift/OpenShiftModal";
import CloseShiftModal from "@/components/shift/CloseShiftModal";
import ShiftReportModal from "@/components/shift/ShiftReportModal";
import RoleBadge from "@/components/RoleBadge";


interface TopBarProps {
	title?: string;
	icon?: React.ReactNode;
	rightAction?: React.ReactNode;
}

export default function TopBar({
	title,
	icon,
	rightAction,
}: TopBarProps) {
	const { toggle: toggleDrawer } = useDrawer();
	const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
	const { user, effectiveRole } = useAuth();
		const [isRefreshing, setIsRefreshing] = useState(false);
	const shift = useShift();
	const [showProfileModal, setShowProfileModal] = useState(false);

	const handleRefresh = async () => {
		if (isRefreshing) return;

		setIsRefreshing(true);
		try {
			await forceSync();
		} catch (error) {
			console.error("Failed to refresh time:", error);
		} finally {
			setIsRefreshing(false);
		}
	};

	const userDisplayName = user?.display_name?.trim() || user?.name?.trim().split(' ')[0] || user?.email?.split("@")[0] || "Worker";

	return (
		<>
			<ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />

			{/* Shift Modals */}
			<OpenShiftModal />
			<CloseShiftModal />
			<ShiftReportModal />

			<div className='shrink-0'>
			<div className='flex items-center justify-between h-22.5 w-full'>
				<div className='flex items-center gap-2 sm:gap-4 flex-1 overflow-x-auto'>
					<button
						onClick={toggleDrawer}
						className='ml-6 my-4.25 h-14 w-14 min-w-14 bg-primary rounded-xl flex justify-center items-center hover:shadow-md transition-all cursor-pointer shrink-0'>
						<MenuBurgerIcon className="text-secondary" />
					</button>

					{/* User Info — click to open profile */}
					<button
						type='button'
						onClick={() => setShowProfileModal(true)}
						className='shrink-0 min-w-7.5 h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-3 items-center font-medium text-3 lg:text-3 hover:bg-light-accent transition-all cursor-pointer group'
					>
						<span className='my-6 w-8 h-8 bg-light-accent rounded-full flex items-center justify-center text-secondary overflow-hidden relative ring-2 ring-accent/0 group-hover:ring-accent/40 transition-all'>
							{user?.profile_picture ? (
								<SafeImage src={user.profile_picture} alt={userDisplayName} />
							) : (
								<span className='text-xs font-bold select-none'>{userDisplayName[0]?.toUpperCase()}</span>
							)}
						</span>
						<span>{userDisplayName}</span>
						<svg className='w-3.5 h-3.5 text-secondary/40 group-hover:text-secondary transition-colors' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M19 9l-7 7-7-7' />
						</svg>
					</button>

					{/* Role Badge */}
					{effectiveRole && <RoleBadge role={effectiveRole} />}

					{/* Shift Control */}
					{!shift.isExempt && (
						<div className='shrink-0'>
							{shift.activeShift ? (
								shift.canManageShift ? (
									<button
										onClick={() => shift.requestCloseShift()}
										className='h-14 px-3 py-3 flex bg-success/10 rounded-xl text-success gap-2 items-center font-medium text-3 border border-success/30 cursor-pointer hover:bg-secondary/10 hover:text-secondary hover:border-secondary transition-all'
										title='Click to close shift'
									>
										<span className='w-2 h-2 bg-success rounded-full animate-pulse' />
										<span className='font-semibold'>On Shift</span>
									</button>
								) : (
									<div className='h-14 px-3 py-3 flex bg-success/10 rounded-xl text-success gap-2 items-center font-medium text-3 border border-success/30'>
										<span className='w-2 h-2 bg-success rounded-full animate-pulse' />
										<span className='font-semibold'>On Shift</span>
									</div>
								)
							) : shift.canManageShift ? (
								<button
									onClick={() => shift.requestOpenShift()}
									className='h-14 px-3 py-3 flex bg-accent/10 rounded-xl text-accent gap-2 items-center font-medium text-3 border border-accent/30 cursor-pointer hover:bg-accent hover:text-primary transition-all'
									title='Click to open shift'
								>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
									</svg>
									<span className='font-semibold'>Open Shift</span>
								</button>
							) : null}
						</div>
					)}

					<div className='shrink-0 min-w-7.5 h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-3 items-center font-medium text-3 lg:text-3'>
							<CalendarIcon className="text-secondary" />
						<div className='flex flex-col items-start'>
							{isLoading && !date ? (
								<LoadingSpinner size='sm' />
							) : (
								<>
									<span>{date}</span>
									{!isInternetTime && date && (
										<span className='text-xs opacity-70'>(Local)</span>
									)}
								</>
							)}
						</div>
					</div>
					<span className='hidden sm:inline'>-</span>
					<div className='shrink-0 min-w-32 h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-3 items-center font-medium text-3 lg:text-3'>
							<ClockIcon className="text-secondary"/>
						<div className='flex flex-row items-center gap-2'>
							{isLoading && !time ? (
								<LoadingSpinner size='sm' />
							) : (
								<>
									<LiveIndicator live={isInternetTime} />
									<span className='animate-pulse '>{time}</span>
								</>
							)}
						</div>
						<button
							onClick={handleRefresh}
							disabled={isRefreshing}
							className='ml-2 p-1 hover:bg-light-accent rounded-full transition-colors disabled:opacity-50 shrink-0'
							title={`${
								isInternetTime ? "Internet time" : "Local time"
							} - Click to sync`}>
							<RefreshIcon
								className='w-4 h-4 text-secondary'
								isSpinning={isRefreshing}
							/>
						</button>
					</div>
				</div>
			</div>

			{/* Page Title */}
			{title && (
				<div className='flex items-center justify-between ml-6 py-1 mr-6'>
					<div className='flex items-center'>
						{icon}
						<h1 className='text-secondary text-xl font-bold'>
							{title}
						</h1>
					</div>
					{rightAction}
				</div>
			)}
			</div>
		</>
	);
}
