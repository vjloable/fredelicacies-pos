"use client";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function NotFound() {
	return (
		<div className='flex items-center justify-center h-full'>
			<div className='text-center'>
				<div className='text-6xl text-gray-400 mb-4'>404</div>
				<h2 className='text-2xl font-semibold text-gray-700 mb-4'>
					Page Not Found
				</h2>
				<p className='text-gray-500 mb-6'>
					The page you're looking for doesn't exist in this branch.
				</p>
				<div className='space-x-4'>
					<Link
						href='../store'
						className='bg-[var(--accent)] text-[var(--primary)] px-6 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-colors'>
						Go to Store
					</Link>
					<Link
						href='/admin/branches'
						className='bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors'>
						All Branches
					</Link>
				</div>
			</div>
		</div>
	);
}
