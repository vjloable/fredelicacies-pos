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
import { useState, useEffect, useCallback } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";
import { faceRecognitionService, FaceRecognitionResult } from "@/services/faceRecognitionService";
import FaceRecognitionCamera from "@/components/FaceRecognitionCamera";

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

	const userDisplayName = user?.email?.split("@")[0] || "Worker";

	// Check if user has face enrollment
	useEffect(() => {
		const checkEnrollment = async () => {
			if (!user || !showTimeTracking) {
				console.log('⚠️ MobileTopBar: No user or time tracking disabled, skipping enrollment check');
				return;
			}
			
			console.log('🔍 MobileTopBar: Checking face enrollment for user:', user.uid);
			
			try {
				const enrolled = await faceRecognitionService.hasEnrollment(user.uid);
				console.log('✅ MobileTopBar: Enrollment check result:', enrolled);
				setHasEnrollment(enrolled);
			} catch (error) {
				console.error('❌ MobileTopBar: Error checking face enrollment:', error);
				setHasEnrollment(false);
			}
		};

		checkEnrollment();
	}, [user, showTimeTracking]);

	// Handle time tracking actions with face recognition
	const handleTimeTrackingClick = async () => {
		console.log('🔵 MobileTopBar: Clock In/Out clicked', { 
			hasUser: !!user, 
			hasWorker: !!timeTracking.worker,
			isWorking: timeTracking.isWorking,
			hasEnrollment,
			userId: user?.uid 
		});

		const isExemptOwner = timeTracking.worker?.isOwner;

		if (!timeTracking.worker || isExemptOwner || isTimeTracking) {
			console.log('❌ MobileTopBar: Cannot proceed - no worker, exempt owner, or already tracking');
			return;
		}

		// Check if face enrollment exists
		if (hasEnrollment === null) {
			console.log('⏳ MobileTopBar: Enrollment status still loading...');
			alert('Checking face enrollment status...');
			return;
		}

		// If no enrollment, prompt to enroll first
		if (!hasEnrollment) {
			console.log('📸 MobileTopBar: No enrollment found, showing prompt');
			const shouldEnroll = confirm(
				'No face enrollment found. You need to enroll your face before clocking in/out. Would you like to enroll now?'
			);
			
			if (shouldEnroll) {
				console.log('✅ MobileTopBar: User agreed to enroll');
				setFaceRecognitionMode('enroll');
				setPendingAction(timeTracking.isWorking ? 'clockOut' : 'clockIn');
				setShowFaceRecognition(true);
			} else {
				console.log('❌ MobileTopBar: User declined enrollment');
			}
			return;
		}

		// Proceed with face verification
		console.log('🔐 MobileTopBar: Proceeding with face verification');
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
			await timeTracking.clockIn(branchId, "Clock-in from MobileTopBar (Face Verified)");
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
			await timeTracking.clockOut("Clock-out from MobileTopBar (Face Verified)");
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Clock out failed';
			alert(errorMessage);
		} finally {
			setIsTimeTracking(false);
		}
	}, [timeTracking, isTimeTracking]);

	// Handle face recognition success
	const handleFaceRecognitionSuccess = useCallback(async (result?: FaceRecognitionResult) => {
		console.log('🎉 MobileTopBar: Face recognition success!', { mode: faceRecognitionMode, result });
		setShowFaceRecognition(false);

		if (faceRecognitionMode === 'enroll') {
			// After enrollment, update state and perform pending action
			console.log('✅ MobileTopBar: Enrollment successful, updating state');
			setHasEnrollment(true);
			alert('Face enrolled successfully! Now verifying your face...');
			
			// Wait a moment then show verification
			setTimeout(() => {
				console.log('🔐 MobileTopBar: Showing verification modal');
				setFaceRecognitionMode('verify');
				setShowFaceRecognition(true);
			}, 1500);
		} else {
			// Verification successful, perform the pending action
			console.log('✅ MobileTopBar: Verification successful, performing action:', pendingAction);
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
		console.log('❌ MobileTopBar: Face recognition cancelled');
		setShowFaceRecognition(false);
		setPendingAction(null);
	}, []);

	// Handle face recognition error
	const handleFaceRecognitionError = useCallback((error: string) => {
		console.error('❌ MobileTopBar: Face recognition error:', error);
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

			<div className='flex-shrink-0 w-full'>
			<div className='flex items-center justify-between h-[70px] px-4 '>
				<button
					onClick={toggleDrawer}
					className='h-12 w-12 bg-[var(--accent)] xl:bg-[var(--primary)] rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
					<MenuBurger className="text-[var(--primary)]"/>
				</button>
				<div className='flex-1 flex justify-center'>
					<div className='flex items-center justify-center rounded-[100px] bg-[var(--accent)] h-12 px-6'>
						<TextLogo className='h-5' />
					</div>
				</div>{" "}
				{onOrderClick ? (
					<button
						onClick={onOrderClick}
						className='h-12 w-12 bg-[var(--accent)] xl:bg-[var(--primary)] rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
						<OrderCartIcon className="h-6 w-6 text-[var(--primary)]" />
					</button>
				) :
					<div className='h-12 w-12' />
				}
			</div>
			<div className='flex items-center gap-3 px-4 py-2 overflow-x-auto'>
				<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
						<UserIcon />
					</span>
					<span>{userDisplayName}</span>
				</div>

				{isUserOwner() && (
					<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-xs'>
						<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] text-xs font-bold'>
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
									? "bg-[var(--success)]/10 text-[var(--success)] border-2 border-[var(--success)] hover:bg-[var(--secondary)]/10 hover:border-[var(--secondary)]"
									: "bg-[var(--secondary)]/10 text-[var(--secondary)] border-2 border-[var(--secondary)] hover:bg-[var(--success)]/10 hover:border-[var(--success)]"
							} ${isTimeTracking ? "opacity-50" : "hover:scale-105"}`}>
							<span
								className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
									timeTracking.isWorking
										? "bg-[var(--success)]/10 text-[var(--success)] group-hover:bg-[var(--secondary)]/10"
										: "bg-[var(--secondary)]/10 text-[var(--secondary)] group-hover:bg-[var(--success)]/10"
								}`}>
								{isTimeTracking ? (
									<div className='animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent' />
								) : timeTracking.isWorking ? (
									<div className="h-3 w-3 border-2 border-dashed border-[var(--success)] animate-spin rounded-full group-hover:border-[var(--secondary)]"/>
								) : (
									<div className="h-3 w-3 border-2 border-[var(--secondary)] rounded-full group-hover:border-[var(--success)]"/>
								)}
							</span>
							<span className={`font-bold 
								${timeTracking.isWorking
									? "opacity-70 group-hover:text-[var(--secondary)]"
									: "opacity-70 group-hover:text-[var(--success)]"
								}`
							}> 
							{timeTracking.isWorking ? "Working" : "Off Duty"}
							</span>
							{!isTimeTracking && (
								<span
									className={`text-xs truncate ${
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
												}m`
											: "Click to end"
										: "Click to start"}
								</span>
							)}
						</button>
					)}

				<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center'>
						<CalendarIcon />
					</span>
					<div className='flex flex-col items-start'>
						{isLoading && !date ? (
							<LoadingSpinner size='sm' />
						) : (
							<>
								<span className="truncate">{date}</span>
								{!isInternetTime && date && (
									<span className='text-[10px] opacity-70'>(Local)</span>
								)}
							</>
						)}
					</div>
				</div>

				<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center flex-shrink-0'>
						<ClockIcon />
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
								<span className='truncate animate-pulse'>{time}</span>
							</>
						)}
					</div>
					<button
						onClick={handleRefresh}
						disabled={isRefreshing}
						className='ml-auto p-1 hover:bg-[var(--light-accent)] rounded-full transition-colors disabled:opacity-50 flex-shrink-0'>
						<RefreshIcon
							className='w-3 h-3 text-[var(--secondary)]'
							isSpinning={isRefreshing}
						/>
					</button>
				</div>
			</div>{" "}
			{title && (
				<div className='flex items-center justify-start px-4 py-2'>
					{icon && <div className='mr-2'>{icon}</div>}
					<h1 className='text-[var(--secondary)] text-xl font-bold'>{title}</h1>
				</div>
			)}
			</div>
		</>
	);
}
