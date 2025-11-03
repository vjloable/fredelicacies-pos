"use client";

import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState, useEffect, useCallback } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";
import MenuBurgerIcon from "@/components/icons/MenuBurger";
import { faceRecognitionService, FaceRecognitionResult } from "@/services/faceRecognitionService";
import FaceRecognitionCamera from "@/components/FaceRecognitionCamera";


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
	
	// Face recognition states
	const [showFaceRecognition, setShowFaceRecognition] = useState(false);
	const [faceRecognitionMode, setFaceRecognitionMode] = useState<'enroll' | 'verify'>('verify');
	const [pendingAction, setPendingAction] = useState<'clockIn' | 'clockOut' | null>(null);
	const [hasEnrollment, setHasEnrollment] = useState<boolean | null>(null);

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

	// Check if user has face enrollment
	useEffect(() => {
		const checkEnrollment = async () => {
			if (!user || !showTimeTracking) {
				console.log('⚠️ TopBar: No user or time tracking disabled, skipping enrollment check');
				return;
			}
			
			console.log('🔍 TopBar: Checking face enrollment for user:', user.uid);
			
			try {
				const enrolled = await faceRecognitionService.hasEnrollment(user.uid);
				console.log('✅ TopBar: Enrollment check result:', enrolled);
				setHasEnrollment(enrolled);
			} catch (error) {
				console.error('❌ TopBar: Error checking face enrollment:', error);
				setHasEnrollment(false);
			}
		};

		checkEnrollment();
	}, [user, showTimeTracking]);

	// Handle time tracking actions with face recognition
	const handleTimeTrackingClick = async () => {
		console.log('🔵 TopBar: Clock In/Out clicked', { 
			hasUser: !!user, 
			hasWorker: !!timeTracking.worker,
			isWorking: timeTracking.isWorking,
			hasEnrollment,
			userId: user?.uid 
		});

		// Owners are exempt from time tracking since they're not assigned to branches
		const isExemptOwner = timeTracking.worker?.isOwner;

		if (!timeTracking.worker || isExemptOwner || isTimeTracking) {
			console.log('❌ TopBar: Cannot proceed - no worker, exempt owner, or already tracking');
			return;
		}

		// Check if face enrollment exists
		if (hasEnrollment === null) {
			console.log('⏳ TopBar: Enrollment status still loading...');
			alert('Checking face enrollment status...');
			return;
		}

		// If no enrollment, prompt to enroll first
		if (!hasEnrollment) {
			console.log('📸 TopBar: No enrollment found, showing prompt');
			const shouldEnroll = confirm(
				'No face enrollment found. You need to enroll your face before clocking in/out. Would you like to enroll now?'
			);
			
			if (shouldEnroll) {
				console.log('✅ TopBar: User agreed to enroll');
				setFaceRecognitionMode('enroll');
				setPendingAction(timeTracking.isWorking ? 'clockOut' : 'clockIn');
				setShowFaceRecognition(true);
			} else {
				console.log('❌ TopBar: User declined enrollment');
			}
			return;
		}

		// Proceed with face verification
		console.log('🔐 TopBar: Proceeding with face verification');
		setFaceRecognitionMode('verify');
		setPendingAction(timeTracking.isWorking ? 'clockOut' : 'clockIn');
		setShowFaceRecognition(true);
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
			await timeTracking.clockIn(branchId, "Clock-in from TopBar (Face Verified)");
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
			await timeTracking.clockOut("Clock-out from TopBar (Face Verified)");
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Clock out failed';
			alert(errorMessage);
		} finally {
			setIsTimeTracking(false);
		}
	}, [timeTracking, isTimeTracking]);

	// Handle face recognition success
	const handleFaceRecognitionSuccess = useCallback(async (result?: FaceRecognitionResult) => {
		console.log('🎉 TopBar: Face recognition success!', { mode: faceRecognitionMode, result });
		setShowFaceRecognition(false);

		if (faceRecognitionMode === 'enroll') {
			// After enrollment, update state and perform pending action
			console.log('✅ TopBar: Enrollment successful, updating state');
			setHasEnrollment(true);
			alert('Face enrolled successfully! Now verifying your face...');
			
			// Wait a moment then show verification
			setTimeout(() => {
				console.log('🔐 TopBar: Showing verification modal');
				setFaceRecognitionMode('verify');
				setShowFaceRecognition(true);
			}, 1500);
		} else {
			// Verification successful, perform the pending action
			console.log('✅ TopBar: Verification successful, performing action:', pendingAction);
			if (pendingAction === 'clockIn') {
				await performClockIn();
			} else if (pendingAction === 'clockOut') {
				await performClockOut();
			}
			
			setPendingAction(null);
		}
	}, [faceRecognitionMode, pendingAction, performClockIn, performClockOut]);

	// Handle face recognition cancel
	const handleFaceRecognitionCancel = useCallback(() => {
		console.log('❌ TopBar: Face recognition cancelled');
		setShowFaceRecognition(false);
		setPendingAction(null);
	}, []);

	// Handle face recognition error
	const handleFaceRecognitionError = useCallback((error: string) => {
		console.error('❌ TopBar: Face recognition error:', error);
		alert(error);
	}, []);

	return (
		<>
			{/* Face Recognition Modal */}
			{showFaceRecognition && user && (
				<FaceRecognitionCamera
					userId={user.uid}
					mode={faceRecognitionMode}
					onSuccess={handleFaceRecognitionSuccess}
					onCancel={handleFaceRecognitionCancel}
					onError={handleFaceRecognitionError}
				/>
			)}

			<div className='flex-shrink-0'>
			<div className='flex items-center justify-between h-[90px] w-full'>
				<div className='flex items-center gap-2 sm:gap-4 flex-1 overflow-x-auto'>
					<button
						onClick={toggleDrawer}
						className='ml-6 my-[17px] h-14 w-14 min-w-14 bg-[var(--primary)] rounded-xl flex justify-center items-center hover:scale-105 hover:shadow-md transition-all cursor-pointer flex-shrink-0'>
						<MenuBurgerIcon className="text-[var(--secondary)]" />
					</button>

					{/* User Info*/}
					<div className='relative group'>
						<div className='flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
							<span className='my-6 w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
								<UserIcon />
							</span>
							<span>{userDisplayName}</span>
						</div>
					</div>

					{/* Owner Badge */}
					{isUserOwner() && (
						<div className='flex-shrink-0'>
							<div className='h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-[12px] lg:text-[14px] '>
								<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] text-lg font-bold'>
									O
								</span>
								<span className='text-[var(--secondary)] font-medium'>
									Owner
								</span>
							</div>
						</div>
					)}

					{/* Work Status Badge - Only for workers and managers, not admins */}
					{showTimeTracking &&
						timeTracking.worker &&
						!timeTracking.worker.isOwner && (
							<div className='flex-shrink-0'>
								<button
									onClick={handleTimeTrackingClick}
									disabled={isTimeTracking}
									className={`relative h-14 px-3 py-3 text-center flex rounded-xl gap-2 items-center font-medium text-[12px] lg:text-[14px] cursor-pointer group transition-all duration-200 ${
										timeTracking.isWorking
											? "bg-[var(--success)]/10 text-[var(--success)] border-2 border-[var(--success)] hover:border-[var(--secondary)] hover:bg-[var(--secondary)]/20 hover:shadow-lg"
											: "bg-[var(--secondary)]/10 text-[var(--secondary)] border-2 border-[var(--secondary)] hover:border-[var(--success)] hover:bg-[var(--success)]/20 hover:shadow-lg"
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
													? "bg-[var(--secondary)]/10"
													: "bg-[var(--success)]/10"
											}`}
										/>
									)}

									<span
										className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
											timeTracking.isWorking
												? "bg-[var(--success)]/10 text-[var(--success)] group-hover:bg-[var(--secondary)]/10 group-hover:text-[var(--secondary)]"
												: "bg-[var(--secondary)]/10 text-[var(--secondary)] group-hover:bg-[var(--success)]/10 group-hover:text-[var(--success)]"
										}`}>
										{isTimeTracking ? (
											<div className='animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent' />
										) : timeTracking.isWorking ? (
											<div className="animate-spin border-2 border-[var(--success)] group-hover:border-[var(--secondary)] border-dashed rounded-full h-3 w-3"/>
										) : (
											<div className="border-2 border-[var(--secondary)] group-hover:border-[var(--success)] rounded-full h-3 w-3"/>
										)}
									</span>
									<div className={`relative z-10 flex flex-col items-start]
											${timeTracking.isWorking 
												? "text-[var(--success)]" 
												: "text-[var(--secondary)]"
											}
										`}>
										<span className={`font-semibold 
												${timeTracking.isWorking 
													? "group-hover:text-[var(--secondary)]" 
													: "group-hover:text-[var(--success)]"
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
														? "opacity-70 group-hover:text-[var(--secondary)]"
														: "opacity-70 group-hover:text-[var(--success)]"
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

					<div className='flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
						<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
							<CalendarIcon className="text-[var(--secondary)]" />
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
					<div className='flex-shrink-0 min-w-[8rem] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
						<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm'>
							<ClockIcon className="text-[var(--secondary)]"/>
						</span>
						<div className='flex flex-row items-center gap-2'>
							{isLoading && !time ? (
								<LoadingSpinner size='sm' />
							) : (
								<>
									{!isInternetTime && time ? (
										<span className='bg-[var(--error)]/20 size-3 border-2 border-[var(--error)] border-dashed rounded-full shadow-sm animate-spin' />
									) : (
										<span className='bg-[var(--success)]/20 size-3 border-2 border-[var(--success)] border-dashed rounded-full shadow-sm animate-spin' />
									)}
									<span className='animate-pulse '>{time}</span>
								</>
							)}
						</div>
						<button
							onClick={handleRefresh}
							disabled={isRefreshing}
							className='ml-2 p-1 hover:bg-[var(--light-accent)] rounded-full transition-colors disabled:opacity-50 flex-shrink-0'
							title={`${
								isInternetTime ? "Internet time" : "Local time"
							} - Click to sync`}>
							<RefreshIcon
								className='w-4 h-4 text-[var(--secondary)]'
								isSpinning={isRefreshing}
							/>
						</button>
					</div>
				</div>
			</div>

			{/* Page Title */}
			{title && (
				<div className='flex items-center justify-start ml-6 py-[4px]'>
					{icon}
					<h1 className='text-[var(--secondary)] text-2xl font-bold'>
						{title}
					</h1>
				</div>
			)}
			</div>
		</>
	);
}
