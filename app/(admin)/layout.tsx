"use client";
import AdminDrawerProvider from "./components/AdminDrawerProvider";
import AuthGuard from "@/components/AuthGuard";
import { BluetoothProvider } from "@/contexts/BluetoothContext";
import AdminSidebar from "./components/AdminSidebar";
import Drawer from "@/components/Drawer";
import { useAuth } from "@/contexts/AuthContext";

interface AdminLayoutProps {
	children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<AuthGuard adminOnly>
			<AdminDrawerProvider>
				<BluetoothProvider>
					<LayoutChooser>{children}</LayoutChooser>
				</BluetoothProvider>
			</AdminDrawerProvider>
		</AuthGuard>
	);
}

function LayoutChooser({ children }: { children: React.ReactNode }) {
	const { user } = useAuth();

	if (user?.isAdmin) {
		return (
			<div className='flex h-full overflow-hidden'>
				<AdminSidebar />
				<main className='flex-1 overflow-auto bg-gray-50 p-6'>{children}</main>
			</div>
		);
	}

	return <Drawer>{children}</Drawer>;
}
