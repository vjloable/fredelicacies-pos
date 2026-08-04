"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLoader from "@/components/PageLoader";
export default function OwnerPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to workers page as default owner view
		router.replace("/owner/workers");
	}, [router]);

	return (
		<div className='flex items-center justify-center h-full'>
			<PageLoader text="Loading owner…" />
		</div>
	);
}
