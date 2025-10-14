"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to workers page as default admin view
		router.replace("/admin/workers");
	}, [router]);

	return (
		<div className='flex items-center justify-center h-full'>
			<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]'></div>
			<span className='ml-3 text-[var(--secondary)]'>Loading admin...</span>
		</div>
	);
}
