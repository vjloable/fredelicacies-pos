"use client";
import AuthGuard from "@/components/AuthGuard";
import { BluetoothProvider } from "@/contexts/BluetoothContext";
import { BranchProvider } from "@/contexts/BranchContext";
import AdminDrawerProvider from "./components/AdminDrawerProvider";

interface AdminLayoutProps {
	children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<AuthGuard adminOnly>
			<AdminDrawerProvider>
				<BluetoothProvider>
					<BranchProvider>
						<div className='flex flex-col h-full overflow-hidden'>
							<main className='flex-1 overflow-auto bg-gray-50'>
								{children}
							</main>
						</div>
					</BranchProvider>
				</BluetoothProvider>
			</AdminDrawerProvider>
		</AuthGuard>
	);
}