"use client";

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import OrderCartIcon from "@/app/(main)/[branchId]/(worker)/store/icons/OrderCartIcon";
import TextLogo from "@/components/icons/TextLogo";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState, useCallback } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";
import { workerService } from "@/services/workerService";
import PinEntryModal from "@/components/PinEntryModal";

interface MobileTopBarProps {
	title?: string;
	icon?: React.ReactNode;
	showTimeTracking?: boolean;
	onOrderClick?: () => void;
}

export default function MobileTopBar({
	title,
	icon,
	showTimeTracking = true,
	onOrderClick,
}: MobileTopBarProps) {
	const { toggle: toggleDrawer } = useDrawer();
	const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
	const { user, isUserOwner } = useAuth();
	const { currentBranch } = useBranch();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isTimeTracking, setIsTimeTracking] = useState(false);
	const timeTracking = useTimeTracking({ autoRefresh: showTimeTracking });
	
	// PIN verification states
	const [showPinModal, setShowPinModal] = useState(false);
	const [pinMode, setPinMode] = useState<'setup' | 'verify'>('verify');
	const [pendingAction, setPendingAction] = useState<'clockIn' | 'clockOut' | null>(null);

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

	// Handle time tracking actions with PIN verification
	const handleTimeTrackingClick = async () => {
		const isExemptOwner = timeTracking.worker?.isOwner;

		if (!timeTracking.worker || isExemptOwner || isTimeTracking || !user) return;

		const action = timeTracking.isWorking ? 'clockOut' : 'clockIn';
		setPendingAction(action);

		// Check if user has a PIN set
		try {
			const hasPinSet = await workerService.hasPin(user.uid);
			setPinMode(hasPinSet ? 'verify' : 'setup');
			setShowPinModal(true);
		} catch (error) {
			console.error('Error checking PIN status:', error);
			alert('Failed to check PIN status. Please try again.');
		}
	};

	// Perform actual clock in after face verification
	const performClockIn = useCallback(async () => {
		if (!timeTracking.worker || isTimeTracking) return;

		setIsTimeTracking(true);
		try {
			const branchId = currentBranch?.id || timeTracking.worker.roleAssignments[0]?.branchId;
			if (!branchId) {
				alert("No branch selected for time tracking");
				return;
			}
			await timeTracking.clockIn(branchId, "Clock-in from MobileTopBar (PIN Verified)");
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Clock in failed';
			alert(errorMessage);
		} finally {
			setIsTimeTracking(false);
		}
	}, [timeTracking, currentBranch, isTimeTracking]);

	// Perform actual clock out after face verification
	const performClockOut = useCallback(async () => {
		if (!timeTracking.worker || isTimeTracking) return;

		setIsTimeTracking(true);
		try {
			await timeTracking.clockOut("Clock-out from MobileTopBar (PIN Verified)");
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Clock out failed';
			alert(errorMessage);
		} finally {
			setIsTimeTracking(false);
		}
	}, [timeTracking, isTimeTracking]);

	// Handle PIN verification success
	const handlePinSuccess = useCallback(async () => {
		setShowPinModal(false);

		if (pendingAction === 'clockIn') {
			await performClockIn();
		} else if (pendingAction === 'clockOut') {
			await performClockOut();
		}

		setPendingAction(null);
	}, [pendingAction, performClockIn, performClockOut]);

	// Handle PIN modal cancel
	const handlePinCancel = useCallback(() => {
		setShowPinModal(false);
		setPendingAction(null);
	}, []);

	return (
		<>
			{/* PIN Verification Modal */}
			{showPinModal && user && (
				<PinEntryModal
					userId={user.uid}
					mode={pinMode}
					onSuccess={handlePinSuccess}
					onCancel={handlePinCancel}
				/>
			)}

			<div className='shrink-0 w-full'>
			<div className='flex items-center justify-between h-17.5 px-4 '>
				<button
					onClick={toggleDrawer}
					className='h-12 w-12 bg-accent xl:bg-primary rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
					<MenuBurger className="text-primary"/>
				</button>
				<div className='flex-1 flex justify-center'>
					<div className='flex items-center justify-center rounded-25 bg-accent h-12 px-6'>
						<TextLogo className='h-5' />
					</div>
				</div>{" "}
				{onOrderClick ? (
					<button
						onClick={onOrderClick}
						className='h-12 w-12 bg-accent xl:bg-primary rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
						<OrderCartIcon className="h-6 w-6 text-primary" />
					</button>
				) :
					<div className='h-12 w-12' />
				}
			</div>
			<div className='flex items-center gap-3 px-4 py-2 overflow-x-auto'>
				<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-(--light-accent) rounded-full flex items-center justify-center text-secondary'>
						<UserIcon />
					</span>
					<span>{userDisplayName}</span>
				</div>

				{isUserOwner() && (
					<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-xs'>
						<span className='w-7 h-7 bg-(--light-accent) rounded-full flex items-center justify-center text-secondary text-xs font-bold'>
							O
						</span>
						<span>Owner</span>
					</div>
				)}
				{showTimeTracking &&
					timeTracking.worker &&
					!timeTracking.worker.isOwner && (
						<button
							onClick={handleTimeTrackingClick}
							disabled={isTimeTracking}
							className={`flex-1 h-12 px-3 py-2 flex rounded-xl gap-2 items-center font-medium text-xs transition-all duration-200 cursor-pointer group ${
								timeTracking.isWorking
									? "bg-(--success)/10 text-(--success) border-2 border-(--success) hover:bg-secondary/10 hover:border-secondary"
									: "bg-secondary/10 text-secondary border-2 border-secondary hover:bg-(--success)/10 hover:border-(--success)"
							} ${isTimeTracking ? "opacity-50" : "hover:scale-105"}`}>
							<span
								className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
									timeTracking.isWorking
										? "bg-(--success)/10 text-(--success) group-hover:bg-secondary/10"
										: "bg-secondary/10 text-secondary group-hover:bg-(--success)/10"
								}`}> 
								{isTimeTracking ? (
									<div className='animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent' />
								) : timeTracking.isWorking ? (
									<div className="h-3 w-3 border-2 border-dashed border-(--success) animate-spin rounded-full group-hover:border-secondary"/>
								) : (
									<div className="h-3 w-3 border-2 border-secondary rounded-full group-hover:border-(--success)"/>
								)}
							</span>
							<span className={`font-bold 
								${timeTracking.isWorking
									? "opacity-70 group-hover:text-secondary"
									: "opacity-70 group-hover:text-(--success)"
								}`
							}> 
							{timeTracking.isWorking ? "Working" : "Off Duty"}
							</span>
							{!isTimeTracking && (
								<span
									className={`text-xs truncate ${
										timeTracking.isWorking
											? "opacity-70 group-hover:text-secondary"
											: "opacity-70 group-hover:text-(--success)"
									}`}>
									{timeTracking.isWorking
										? timeTracking.workingDuration > 0
											? `${Math.floor(
													timeTracking.workingDuration / 60
												)}h ${
													timeTracking.workingDuration % 60
												}m`
											: "Click to end"
										: "Click to start"}
								</span>
							)}
						</button>
					)}

				<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-(--light-accent) rounded-full flex items-center justify-center'>
						<CalendarIcon />
					</span>
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
					<span className='w-7 h-7 bg-(--light-accent) rounded-full flex items-center justify-center shrink-0'>
						<ClockIcon />
					</span>
					<div className='flex flex-row items-center gap-2'>
						{isLoading && !time ? (
							<LoadingSpinner size='sm' />
						) : (
							<>
								{!isInternetTime && time ? (
									<span className='bg-(--error)/20 size-3 border-2 border-(--error) border-dashed rounded-full shadow-sm animate-spin' />
								) : (
									<span className='bg-(--success)/20 size-3 border-2 border-(--success) border-dashed rounded-full shadow-sm animate-spin' />
								)}
								<span className='truncate animate-pulse'>{time}</span>
							</>
						)}
					</div>
					<button
						onClick={handleRefresh}
						disabled={isRefreshing}
						className='ml-auto p-1 hover:bg-(--light-accent) rounded-full transition-colors disabled:opacity-50 shrink-0'>
						<RefreshIcon
							className='w-3 h-3 text-secondary'
							isSpinning={isRefreshing}
						/>
					</button>
				</div>
			</div>{" "}
			{title && (
				<div className='flex items-center justify-start px-4 py-2'>
					{icon && <div className='mr-2'>{icon}</div>}
					<h1 className='text-secondary text-lg font-bold'>{title}</h1>
				</div>
			)}
			</div>
		</>
	);
}
