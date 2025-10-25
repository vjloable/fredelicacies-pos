"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function OwnerPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to workers page as default owner view
		router.replace("/owner/workers");
	}, [router]);

	return (
		<div className='flex items-center justify-center h-full'>
			<LoadingSpinner size='lg' />
			<span className='ml-3 text-[var(--secondary)]'>Loading owner...</span>
		</div>
	);
}
