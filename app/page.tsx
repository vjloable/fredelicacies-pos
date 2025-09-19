"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function RootPage() {
	const router = useRouter();
	const { loading, isAuthenticated } = useAuth();

	useEffect(() => {
		if (!loading) {
			if (isAuthenticated) {
				// User is authenticated, redirect to store
				router.push("/store");
			} else {
				// User is not authenticated, redirect to login
				router.push("/login");
			}
		}
	}, [loading, isAuthenticated, router]);

	return (
		<div className='flex flex-col items-center justify-center h-screen bg-[var(--background)]'>
			<LoadingSpinner />
			<p className='text-[var(--secondary)] mt-4'>Loading...</p>
		</div>
	);
}
