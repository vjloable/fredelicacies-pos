"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function RootPage() {
	const router = useRouter();
	const { user, loading, isAuthenticated, isUserOwner } = useAuth();

	useEffect(() => {
		if (!loading) {
			if (isAuthenticated && user) {
				// Check if user is owner
				if (isUserOwner()) {
					router.push("/owner/branches");
					return;
				}

				// Check if user has branch assignments
				const branchId = user?.roleAssignments?.[0]?.branchId;
				if (branchId) {
					router.push(`/${branchId}/store`);
				} else {
					// User has no branch assignments - redirect to login
					console.log("User has no branch assignments. Redirecting to login.");
					router.push("/login");
				}
			} else {
				// User is not authenticated, redirect to login
				router.push("/login");
			}
		}
	}, [loading, isAuthenticated, user, isUserOwner, router]);

	return (
		// <div className='flex flex-col items-center justify-center h-screen bg-[var(--background)]'>
		<div className='flex flex-row items-center justify-center h-screen space-x-4 bg-[var(--background)]'>
			<LoadingSpinner size="lg" />
			<p className='text-[var(--secondary)] mt-4'>Loading...</p>
		</div>
	);
}
