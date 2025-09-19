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
}

const BranchCard: React.FC<BranchCardProps> = ({ branch, formatDate }) => {
	return (
		<div
			key={branch.branchId}
			className={`bg-white rounded-2xl shadow border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${styles.cartoonCard}`}>
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
					<button
						className='px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--primary)] font-semibold hover:bg-[var(--accent)]/80 transition-colors'
						title='View Branch'>
						View
					</button>
					<button
						className='px-3 py-1 rounded-lg bg-[var(--primary)] text-[var(--secondary)] font-semibold border border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors'
						title='Edit Branch'>
						Edit
					</button>
				</div>
			</div>
		</div>
	);
};

export default BranchCard;
