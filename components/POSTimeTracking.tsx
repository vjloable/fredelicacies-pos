import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { branchService, Branch } from "@/services/branchService";
import { workerService } from "@/services/workerService";
import PinEntryModal from "@/components/PinEntryModal";
import LoadingSpinner from "@/components/LoadingSpinner";

interface POSTimeTrackingProps {
	currentBranchId: string;
	onStatusChange?: (isWorking: boolean) => void;
}

export default function POSTimeTracking({
	currentBranchId,
	onStatusChange,
}: POSTimeTrackingProps) {
	console.log('🚀 POSTimeTracking component mounted/rendered');
	
	const { user } = useAuth();
	const timeTracking = useTimeTracking({ autoRefresh: true });
	const [loading, setLoading] = useState(false);
	const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
	const [showPinModal, setShowPinModal] = useState(false);
	const [pinMode, setPinMode] = useState<'setup' | 'verify'>('verify');
	const [pendingAction, setPendingAction] = useState<'clockIn' | 'clockOut' | null>(null);

	console.log('📊 Component State:', {
		hasUser: !!user,
		userId: user?.uid,
		hasWorker: !!timeTracking.worker,
		isWorking: timeTracking.isWorking,
		showPinModal,
		pinMode: pinMode,
	});

	const loadBranchData = useCallback(async () => {
		try {
			const { branch, error } = await branchService.getBranchById(currentBranchId);
			if (error) {
				console.error("Error loading branch data:", error);
				return;
			}
			setCurrentBranch(branch);
		} catch (err: unknown) {
			console.error("Error loading branch data:", err);
		}
	}, [currentBranchId]);

	useEffect(() => {
		loadBranchData();
	}, [loadBranchData]);

	useEffect(() => {
		// Notify parent component when status changes
		if (onStatusChange) {
			onStatusChange(timeTracking.isWorking);
		}
	}, [timeTracking.isWorking, onStatusChange]);

	const handleTimeIn = useCallback(async () => {
		if (!user || !timeTracking.worker) return;

		setPendingAction('clockIn');

		try {
			const hasPinSet = await workerService.hasPin(user.uid);
			setPinMode(hasPinSet ? 'verify' : 'setup');
			setShowPinModal(true);
		} catch (error) {
			console.error('Error checking PIN status:', error);
			alert('Failed to check PIN status. Please try again.');
		}
	}, [user, timeTracking.worker]);

	const performClockIn = useCallback(async () => {
		if (!user || !timeTracking.worker) return;

		setLoading(true);

		try {
			await timeTracking.clockIn(
				currentBranchId,
				`Self time-in at POS - ${currentBranch?.name || "Unknown Branch"} (PIN Verified)`
			);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Error timing in';
			alert(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [user, timeTracking.worker, timeTracking.clockIn, currentBranchId, currentBranch?.name]);

	const handleTimeOut = useCallback(async () => {
		if (!user || !timeTracking.worker || !timeTracking.currentAttendance) return;

		setPendingAction('clockOut');

		try {
			const hasPinSet = await workerService.hasPin(user.uid);
			setPinMode(hasPinSet ? 'verify' : 'setup');
			setShowPinModal(true);
		} catch (error) {
			console.error('Error checking PIN status:', error);
			alert('Failed to check PIN status. Please try again.');
		}
	}, [user, timeTracking.worker, timeTracking.currentAttendance]);

	const performClockOut = useCallback(async () => {
		if (!user || !timeTracking.worker || !timeTracking.currentAttendance) return;

		setLoading(true);

		try {
			await timeTracking.clockOut(
				`Self time-out at POS - ${currentBranch?.name || "Unknown Branch"} (PIN Verified)`
			);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Error timing out';
			alert(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [user, timeTracking.worker, timeTracking.currentAttendance, timeTracking.clockOut, currentBranch?.name]);

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

	// Memoize the access check to prevent unnecessary re-calculations
	const accessInfo = useMemo(() => {
		// Don't show for users without time tracking access
		// (owners without manager role assignments are exempt)
		const isExemptOwner =
			timeTracking.worker?.isOwner &&
			!timeTracking.worker.roleAssignments.some(
				(assignment) => assignment.role === "manager"
			);

		if (!user || !timeTracking.worker || isExemptOwner) {
			return { shouldShow: false, hasAccess: false };
		}

		// Check if worker has access to this branch
		const hasAccessToBranch = timeTracking.worker.roleAssignments.some(
			(assignment: { branchId: string; isActive: boolean }) =>
				assignment.branchId === currentBranchId && assignment.isActive
		);

		return { shouldShow: true, hasAccess: hasAccessToBranch };
	}, [user, timeTracking.worker, currentBranchId]);

	if (!accessInfo.shouldShow) {
		return null;
	}

	if (!accessInfo.hasAccess) {
		return (
			<div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
				<div className='flex items-center'>
					<svg
						className='w-5 h-5 text-yellow-400 mr-3'
						fill='currentColor'
						viewBox='0 0 20 20'>
						<path
							fillRule='evenodd'
							d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
							clipRule='evenodd'
						/>
					</svg>
					<p className='text-yellow-800 text-xs'>
						You don&apos;t have access to clock in/out at this branch location.
					</p>
				</div>
			</div>
		);
	}

	const isWorking = timeTracking.isWorking;

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

			<div className='bg-white border border-gray-200 rounded-lg shadow-sm'>
			{/* Header */}
			<div className='px-4 py-3 border-b border-gray-200 bg-gray-50'>
				<div className='flex items-center justify-between'>
					<div>
						<h3 className='text-xs font-semibold text-gray-900'>
							Time Tracking
						</h3>
						<p className='text-xs text-gray-600'>
							{currentBranch?.name || "Unknown Branch"}
						</p>
					</div>
					<div
						className={`w-3 h-3 rounded-full ${
							isWorking ? "bg-green-400 animate-pulse" : "bg-gray-300"
						}`}></div>
				</div>
			</div>

			{/* Content */}
			<div className='p-4'>
				{timeTracking.error && (
					<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
						<p className='text-red-700 text-xs'>{timeTracking.error}</p>
					</div>
				)}

				{/* Current Status Display */}
				<div className='mb-4'>
					<div className='flex items-center justify-between'>
						<div>
							<span className='text-xs text-gray-600'>Current Status:</span>
							<div
								className={`inline-flex items-center mt-1 px-2 py-1 rounded-full text-xs font-medium ${
									isWorking
										? "bg-green-100 text-green-800"
										: "bg-gray-100 text-gray-800"
								}`}>
								<div
									className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
										isWorking ? "bg-green-400" : "bg-gray-400"
									}`}
								/>
								{isWorking ? "Clocked In" : "Clocked Out"}
							</div>
						</div>

						{/* Duration if working */}
						{isWorking && timeTracking.currentAttendance && (
							<div className='text-right'>
								<span className='text-xs text-gray-600'>Working for:</span>
								<div className='text-base font-semibold text-gray-900'>
									{Math.floor(timeTracking.workingDuration / 60)}h{" "}
									{timeTracking.workingDuration % 60}m
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Session Details */}
				{isWorking && timeTracking.currentAttendance && (
					<div className='mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
						<div className='text-xs'>
							<div className='flex justify-between items-center mb-1'>
								<span className='text-blue-700 font-medium'>Started at:</span>
								<span className='text-blue-900'>
									{new Date(
										timeTracking.currentAttendance.timeInAt.toDate
											? timeTracking.currentAttendance.timeInAt.toDate()
											: timeTracking.currentAttendance.timeInAt
									).toLocaleTimeString()}
								</span>
							</div>
							{timeTracking.currentAttendance.notes && (
								<div className='text-blue-700 text-xs mt-2'>
									Note: {timeTracking.currentAttendance.notes}
								</div>
							)}
						</div>
					</div>
				)}


				{/* Action Button */}
				<div className='flex flex-col space-y-2'>
					{!isWorking ? (
						<button
							onClick={handleTimeIn}
						disabled={loading || timeTracking.loading}
						className='w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'>
						{loading || timeTracking.loading ? (
							<div className='flex items-center'>
								<LoadingSpinner className="border-white mr-2" />
								Clocking In...
								</div>
							) : (
								<div className='flex items-center'>
									<svg
										className='w-4 h-4 mr-2'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
										/>
									</svg>
									Clock In
								</div>
							)}
						</button>
					) : (
						<button
							onClick={handleTimeOut}
							disabled={loading || timeTracking.loading}
							className='w-full flex items-center justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'>
							{loading || timeTracking.loading ? (
								<div className='flex items-center'>
									<LoadingSpinner className="border-white mr-2" />
									Clocking Out...
								</div>
							) : (
								<div className='flex items-center'>
									<svg
										className='w-4 h-4 mr-2'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
										/>
									</svg>
									Clock Out
								</div>
							)}
						</button>
					)}

					{/* Quick Actions */}
					<div className='flex space-x-2 pt-2 border-t border-gray-200'>
						<button className='flex-1 text-xs text-gray-600 hover:text-gray-800 py-2'>
							View My Sessions
						</button>
						<button className='flex-1 text-xs text-gray-600 hover:text-gray-800 py-2'>
							Report Issue
						</button>
					</div>
				</div>
			</div>

			{/* Current Time Display */}
			<div className='px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg'>
				<div className='flex items-center justify-between'>
					<span className='text-xs text-gray-600'>Current time:</span>
					<span className='text-xs font-mono text-gray-900'>
						{new Date().toLocaleTimeString()}
					</span>
				</div>
			</div>
			</div>
		</>
	);
}
