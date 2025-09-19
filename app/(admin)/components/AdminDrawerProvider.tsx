"use client";

import React from "react";
import Drawer, { useDrawer } from "@/components/Drawer";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AdminDrawerProvider places the app's Drawer at the admin layout root.
 * It reads the current user and passes `isAdminPage` so the Drawer can
 * avoid rendering the regular `SidebarNav` when we're rendering a
 * separate `AdminSidebar`.
 */
export default function AdminDrawerProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user } = useAuth();

	return (
		<div className='flex h-screen bg-[var(--background)] overflow-hidden fixed inset-0'>
			<Drawer isAdminPage={!!user?.isAdmin}>{children}</Drawer>
		</div>
	);
}

/** Proxy hook so admin components can import `useAdminDrawer` */
export function useAdminDrawer() {
	return useDrawer();
}
