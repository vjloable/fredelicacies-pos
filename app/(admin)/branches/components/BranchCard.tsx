import React from "react";
import BranchStatusIcon from "./BranchStatusIcon";
import styles from "../page.module.css";

interface BranchCardProps {
	branch: {
		branchId: string;
		name: string;
		location: string;
		createdAt: Date;
		updatedAt: Date;
		isActive: boolean;
		image: string;
	};
	formatDate: (date: Date) => string;
	onView?: (branchId: string) => void;
	onEdit?: (branchId: string) => void;
	onDelete?: (branchId: string) => void;
	onClick?: (branchId: string) => void;
}

const BranchCard: React.FC<BranchCardProps> = ({ 
	branch, 
	formatDate, 
	onView, 
	onEdit, 
	onDelete, 
	onClick 
}) => {
	const handleCardClick = () => {
		if (onClick) {
			onClick(branch.branchId);
		}
	};

	const handleActionClick = (
		e: React.MouseEvent,
		action: () => void
	) => {
		e.stopPropagation(); // Prevent card click
		action();
	};
	return (
		<div
			key={branch.branchId}
			onClick={handleCardClick}
			className={`bg-white rounded-2xl shadow border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${styles.cartoonCard} ${onClick ? 'cursor-pointer' : ''}`}>
			<div className='relative h-40 w-full bg-[var(--accent)] flex items-center justify-center'>
				<img
					src={branch.image}
					alt={branch.name + " branch"}
					className='h-20 w-20 object-contain drop-shadow-lg'
					style={{
						filter: branch.isActive ? "none" : "grayscale(1) opacity(0.5)",
					}}
				/>
				<span className='absolute top-3 right-3'>
					<BranchStatusIcon isActive={branch.isActive} />
				</span>
			</div>
			<div className='flex-1 flex flex-col gap-2 px-5 py-4'>
				<div className='flex items-center gap-2'>
					<h2 className='text-lg font-bold text-[var(--secondary)]'>
						{branch.name}
					</h2>
				</div>
				<div className='text-sm text-[var(--secondary)] opacity-80'>
					{branch.location}
				</div>
				<div className='flex flex-wrap gap-4 mt-2 text-xs text-[var(--secondary)] opacity-70'>
					<span>Created: {formatDate(branch.createdAt)}</span>
					<span>Updated: {formatDate(branch.updatedAt)}</span>
				</div>
				<div className='flex gap-2 mt-4'>
					{onView && (
						<button
							onClick={(e) => handleActionClick(e, () => onView(branch.branchId))}
							className='flex-1 px-3 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors text-sm flex items-center justify-center gap-1'
							title='View Branch Details'>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
							View
						</button>
					)}
					{onEdit && (
						<button
							onClick={(e) => handleActionClick(e, () => onEdit(branch.branchId))}
							className='flex-1 px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--primary)] font-semibold hover:bg-[var(--accent)]/80 transition-colors text-sm flex items-center justify-center gap-1'
							title='Edit Branch'>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							Edit
						</button>
					)}
					{onDelete && (
						<button
							onClick={(e) => handleActionClick(e, () => onDelete(branch.branchId))}
							className='px-3 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm flex items-center justify-center gap-1'
							title='Delete Branch'>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default BranchCard;
