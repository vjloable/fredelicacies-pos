import React from "react";

const BranchMainIcon: React.FC = () => {
	return (
		<span className='inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-400/80 text-primary text-xs font-semibold shadow border border-orange-500'>
			<svg
				className='w-4 h-4 text-primary'
				fill='currentColor'
				viewBox='0 0 20 20'>
				<path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.96a1 1 0 00.95.69h4.163c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.96c.3.922-.755 1.688-1.539 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.196-1.539-1.118l1.287-3.96a1 1 0 00-.364-1.118L2.05 9.387c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.96z' />
			</svg>{" "}
			Main Branch
		</span>
	);
};

export default BranchMainIcon;
