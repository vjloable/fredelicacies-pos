"use client";

import { useState } from "react";
import { Branch } from "@/services/branchService";
import LoadingSpinner from "@/components/LoadingSpinner";

interface MakeMainConfirmationModalProps {
	isOpen: boolean;
	branch: Branch | null;
	currentMainName?: string | null;
	onClose: () => void;
	onConfirm: () => Promise<void>;
}

export default function MakeMainConfirmationModal({
	isOpen,
	branch,
	currentMainName,
	onClose,
	onConfirm,
}: MakeMainConfirmationModalProps) {
	const [loading, setLoading] = useState(false);

	if (!isOpen || !branch) return null;

	const handleConfirm = async () => {
		setLoading(true);
		try {
			await onConfirm();
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) onClose();
	};

	return (
		<div
			className='fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4 sm:p-6'
			onClick={handleClose}>
			<div
				className='bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto'
				onClick={(e) => e.stopPropagation()}>
				{loading ? (
					/* Loading Screen */
					<div className='text-center py-12'>
						<div className='w-16 h-16 bg-accent/15 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<LoadingSpinner size='lg' className='border-accent' />
						</div>
						<h3 className='text-lg font-bold text-secondary mb-2'>
							Setting Main Branch...
						</h3>
						<p className='text-secondary opacity-70'>
							Please wait while we update your branches
						</p>
					</div>
				) : (
					<>
						{/* Modal Header */}
						<div className='text-center mb-6'>
							<div className='w-16 h-16 bg-accent/15 rounded-xl mx-auto mb-4 flex items-center justify-center'>
								<svg
									className='w-7 h-7 text-accent'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
									/>
								</svg>
							</div>
							<h3 className='text-lg font-bold text-secondary mb-2'>
								Set as Main Branch?
							</h3>
							<p className='text-secondary opacity-70'>
								The main branch is the one everyone else follows
							</p>
						</div>

						{/* Branch Info */}
						<div className='bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 bg-accent/15 rounded-lg flex items-center justify-center shrink-0'>
									<svg
										className='w-5 h-5 text-accent'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
										/>
									</svg>
								</div>
								<div className='flex-1 min-w-0'>
									<h4 className='font-semibold text-secondary mb-0.5 truncate'>
										{branch.name}
									</h4>
									{branch.address && (
										<p className='text-xs text-secondary/70 truncate'>
											{branch.address}
										</p>
									)}
								</div>
							</div>
						</div>

						{/* What this means */}
						<div className='space-y-3 mb-6'>
							<div className='flex items-start gap-3'>
								<span className='w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0 text-xs font-bold'>
									1
								</span>
								<p className='text-xs text-secondary'>
									This branch&apos;s products, categories and bundles become the
									master copy.
								</p>
							</div>
							<div className='flex items-start gap-3'>
								<span className='w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0 text-xs font-bold'>
									2
								</span>
								<p className='text-xs text-secondary'>
									Other branches can sync from here to stay up to date with the
									latest catalog.
								</p>
							</div>
							<div className='flex items-start gap-3'>
								<span className='w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0 text-xs font-bold'>
									3
								</span>
								<p className='text-xs text-secondary'>
									{currentMainName
										? `“${currentMainName}” will no longer be the main branch.`
										: "Only one branch can be the main branch at a time."}
								</p>
							</div>
						</div>

						{/* Reassurance Note */}
						<div className='bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6'>
							<p className='text-xs text-secondary/70'>
								Don&apos;t worry — this won&apos;t change any sales, stock or
								staff. You can switch the main branch again anytime.
							</p>
						</div>

						{/* Action Buttons */}
						<div className='flex flex-col sm:flex-row gap-3 sm:gap-4'>
							<button
								onClick={handleClose}
								className='w-full sm:flex-1 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-secondary rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm'>
								Cancel
							</button>
							<button
								onClick={handleConfirm}
								className='w-full sm:flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition-all text-xs sm:text-sm bg-accent hover:bg-accent/90 text-primary hover:scale-105 active:scale-95 cursor-pointer'>
								Set as Main Branch
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
