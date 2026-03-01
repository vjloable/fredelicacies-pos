"use client";

import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState, useCallback } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";
import MenuBurgerIcon from "@/components/icons/MenuBurger";
import { workerService } from "@/services/workerService";
import PinEntryModal from "@/components/PinEntryModal";


interface TopBarProps {
	title?: string;
	icon?: React.ReactNode;
	showTimeTracking?: boolean;
}

export default function TopBar({
	title,
	icon,
	showTimeTracking = true,
}: TopBarProps) {
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

	// Extract user display name from email
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
			await timeTracking.clockIn(branchId, "Clock-in from TopBar (PIN Verified)");
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
			await timeTracking.clockOut("Clock-out from TopBar (PIN Verified)");
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

			<div className='shrink-0'>
			<div className='flex items-center justify-between h-22.5 w-full'>
				<div className='flex items-center gap-2 sm:gap-4 flex-1 overflow-x-auto'>
					<button
						onClick={toggleDrawer}
						className='ml-6 my-4.25 h-14 w-14 min-w-14 bg-primary rounded-xl flex justify-center items-center hover:scale-105 hover:shadow-md transition-all cursor-pointer shrink-0'>
						<MenuBurgerIcon className="text-secondary" />
					</button>

					{/* User Info*/}
					<div className='relative group'>
						<div className='shrink-0 min-w-7.5 h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-3 items-center font-medium text-3 lg:text-3'>
							<span className='my-6 w-8 h-8 bg-light-accent rounded-full flex items-center justify-center text-secondary'>
								<UserIcon />
							</span>
							<span>{userDisplayName}</span>
						</div>
					</div>

					{/* Owner Badge */}
					{isUserOwner() && (
						<div className='shrink-0'>
							<div className='h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-3 lg:text-3 '>
								<span className='w-8 h-8 bg-light-accent rounded-full flex items-center justify-center text-secondary text-base font-bold'>
									O
								</span>
								<span className='text-secondary font-medium'>
									Owner
								</span>
							</div>
						</div>
					)}

					{/* Work Status Badge - Only for workers and managers, not admins */}
					{showTimeTracking &&
						timeTracking.worker &&
						!timeTracking.worker.isOwner && (
							<div className='shrink-0'>
								<button
									onClick={handleTimeTrackingClick}
									disabled={isTimeTracking}
									className={`relative h-14 px-3 py-3 text-center flex rounded-xl gap-2 items-center font-medium text-3 lg:text-3 cursor-pointer group transition-all duration-200 ${
										timeTracking.isWorking
											? "bg-success/10 text-success border-2 border-success hover:border-secondary hover:bg-secondary/20 hover:shadow-lg"
											: "bg-secondary/10 text-secondary border-2 border-secondary hover:border-success hover:bg-success/20 hover:shadow-lg"
									} ${
										isTimeTracking
											? "opacity-50 cursor-not-allowed"
											: "hover:scale-105"
									}`}
									title={
										timeTracking.isWorking
											? "Click to clock out"
											: "Click to clock in"
									}>
									{/* Click indicator overlay */}
									{!isTimeTracking && (
										<div
											className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 ${
												timeTracking.isWorking
													? "bg-secondary/10"
													: "bg-success/10"
											}`}
										/>
									)}

									<span
										className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
											timeTracking.isWorking
												? "bg-success/10 text-success group-hover:bg-secondary/10 group-hover:text-secondary"
												: "bg-secondary/10 text-secondary group-hover:bg-success/10 group-hover:text-success"
										}`}>
										{isTimeTracking ? (
											<LoadingSpinner className="w-3! h-3! border-current" />
										) : timeTracking.isWorking ? (
											<LoadingSpinner className="w-3! h-3! border-success group-hover:border-secondary" />
										) : (
											<div className="border-2 border-secondary group-hover:border-success rounded-full h-3 w-3"/>
										)}
									</span>
									<div className={`relative z-10 flex flex-col items-start]
											${timeTracking.isWorking 
												? "text-success" 
												: "text-secondary"
											}
										`}>
										<span className={`font-semibold 
												${timeTracking.isWorking 
													? "group-hover:text-secondary" 
													: "group-hover:text-success"
												}
											`}>
											{isTimeTracking
												? timeTracking.isWorking
													? "Clocking out..."
													: "Clocking in..."
												: timeTracking.isWorking
												? "Working"
												: "Off Duty"}
										</span>
										{!isTimeTracking && (
											<span
												className={`text-xs ${
													timeTracking.isWorking
														? "opacity-70 group-hover:text-secondary"
														: "opacity-70 group-hover:text-success"
												}`}>
												{timeTracking.isWorking
													? timeTracking.workingDuration > 0
														? `${Math.floor(
																timeTracking.workingDuration / 60
														  )}h ${
																timeTracking.workingDuration % 60
														  }m • Click to end`
														: "Click to end"
													: "Click to start"}
											</span>
										)}
									</div>
								</button>
							</div>
						)}

					<div className='shrink-0 min-w-7.5 h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-3 items-center font-medium text-3 lg:text-3'>
						<span className='w-8 h-8 bg-light-accent rounded-full flex items-center justify-center text-secondary'>
							<CalendarIcon className="text-secondary" />
						</span>
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
						<span className='w-8 h-8 bg-light-accent rounded-full flex items-center justify-center text-secondary font-bold text-xs'>
							<ClockIcon className="text-secondary"/>
						</span>
						<div className='flex flex-row items-center gap-2'>
							{isLoading && !time ? (
								<LoadingSpinner size='sm' />
							) : (
								<>
									{!isInternetTime && time ? (
										<LoadingSpinner className="w-3! h-3! border-error bg-error/20 shadow-sm" />
									) : (
										<LoadingSpinner className="w-3! h-3! border-success bg-success/20 shadow-sm" />
									)}
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
				<div className='flex items-center justify-start ml-6 py-1'>
					{icon}
					<h1 className='text-secondary text-xl font-bold'>
						{title}
					</h1>
				</div>
			)}
			</div>
		</>
	);
}
