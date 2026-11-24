"use client";

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import OrderCartIcon from "@/app/(main)/[branchId]/(frontline)/store/icons/OrderCartIcon";
import TextLogo from "@/components/icons/TextLogo";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import LiveIndicator from "@/components/LiveIndicator";
import { useState } from "react";
import { useShift } from "@/contexts/ShiftContext";
import OpenShiftModal from "@/components/shift/OpenShiftModal";
import CloseShiftModal from "@/components/shift/CloseShiftModal";
import ShiftReportModal from "@/components/shift/ShiftReportModal";
import RoleBadge from "@/components/RoleBadge";

interface MobileTopBarProps {
	title?: string;
	icon?: React.ReactNode;
	onOrderClick?: () => void;
	topRightAction?: React.ReactNode;
	rightAction?: React.ReactNode;
}

export default function MobileTopBar({
	title,
	icon,
	onOrderClick,
	topRightAction,
	rightAction,
}: MobileTopBarProps) {
	const { toggle: toggleDrawer } = useDrawer();
	const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
	const { user, effectiveRole } = useAuth();
	const shift = useShift();
	const [isRefreshing, setIsRefreshing] = useState(false);
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

	const userDisplayName = user?.email?.split("@")[0] || "Worker";

	return (
		<>
			{/* Shift Modals */}
			<OpenShiftModal />
			<CloseShiftModal />
			<ShiftReportModal />

			<div className='shrink-0 w-full'>
			<div className='flex items-center justify-between h-17.5 px-4 '>
				<button
					onClick={toggleDrawer}
					className='h-12 w-12 bg-accent xl:bg-primary rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
					<MenuBurger className="text-primary"/>
				</button>
				<div className='flex-1 flex justify-center'>
					<div className='flex items-center justify-center rounded-sm bg-accent h-12 px-6'>
						<TextLogo className='h-5' />
					</div>
				</div>{" "}
				{topRightAction ?? (onOrderClick ? (
					<button
						onClick={onOrderClick}
						className='h-12 w-12 bg-accent xl:bg-primary rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
						<OrderCartIcon className="h-6 w-6 text-primary" />
					</button>
				) :
					<div className='h-12 w-12' />
				)}
			</div>
			<div className='flex items-center gap-3 px-4 py-2 overflow-x-auto'>
				<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-xs'>
						<UserIcon />
					<span>{userDisplayName}</span>
				</div>

				{effectiveRole && <RoleBadge role={effectiveRole} variant='mobile' />}
				{/* Shift Control */}
				{!shift.isExempt && (
					shift.activeShift ? (
						shift.canManageShift ? (
							<button
								onClick={() => shift.requestCloseShift()}
								className='h-12 px-3 py-2 flex bg-success/10 rounded-xl text-success gap-2 items-center font-medium text-xs border border-success/30 cursor-pointer hover:bg-secondary/10 hover:text-secondary transition-all'
								title='Close shift'
							>
								<span className='w-2 h-2 bg-success rounded-full animate-pulse' />
								<span className='font-bold'>Shift</span>
							</button>
						) : (
							<div className='h-12 px-3 py-2 flex bg-success/10 rounded-xl text-success gap-2 items-center font-medium text-xs border border-success/30'>
								<span className='w-2 h-2 bg-success rounded-full animate-pulse' />
								<span className='font-bold'>Shift</span>
							</div>
						)
					) : shift.canManageShift ? (
						<button
							onClick={() => shift.requestOpenShift()}
							className='h-12 px-3 py-2 flex bg-accent/10 rounded-xl text-accent gap-2 items-center font-medium text-xs border border-accent/30 cursor-pointer hover:bg-accent hover:text-primary transition-all'
							title='Open shift'
						>
							<span className='font-bold'>+ Shift</span>
						</button>
					) : null
				)}

				<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-xs'>
						<CalendarIcon />
					<div className='flex flex-col items-start'>
						{isLoading && !date ? (
							<LoadingSpinner size='sm' />
						) : (
							<>
								<span className="truncate">{date}</span>
								{!isInternetTime && date && (
									<span className='text-2.5 opacity-70'>(Local)</span>
								)}
							</>
						)}
					</div>
				</div>

				<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-3 items-center font-medium text-xs'>
						<ClockIcon />
					<div className='flex flex-row items-center gap-2'>
						{isLoading && !time ? (
							<LoadingSpinner size='sm' />
						) : (
							<>
								<LiveIndicator live={isInternetTime} />
								<span className='truncate animate-pulse'>{time}</span>
							</>
						)}
					</div>
					<button
						onClick={handleRefresh}
						disabled={isRefreshing}
						className='ml-auto p-1 hover:bg-light-accent rounded-full transition-colors disabled:opacity-50 shrink-0'>
						<RefreshIcon
							className='w-3 h-3 text-secondary'
							isSpinning={isRefreshing}
						/>
					</button>
				</div>
			</div>{" "}
			{title && (
				<div className='flex items-center justify-between px-4 py-2'>
					<div className='flex items-center'>
						{icon && <div className='mr-2'>{icon}</div>}
						<h1 className='text-secondary text-lg font-bold'>{title}</h1>
					</div>
					{rightAction}
				</div>
			)}
			</div>
		</>
	);
}
