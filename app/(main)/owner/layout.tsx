"use client";
import AuthGuard from "@/components/AuthGuard";
import { BluetoothProvider } from "@/contexts/BluetoothContext";
import { BranchProvider } from "@/contexts/BranchContext";
import DrawerProvider from "@/components/DrawerProvider";

interface OwnerLayoutProps {
	children: React.ReactNode;
}

export default function OwnerLayout({ children }: OwnerLayoutProps) {
	return (
		<AuthGuard ownerOnly>
			<DrawerProvider>
				<BluetoothProvider>
					<BranchProvider>
						<div className='flex flex-col h-full overflow-hidden'>
							<main className='flex-1 overflow-auto bg-gray-50'>
								{children}
							</main>
						</div>
					</BranchProvider>
				</BluetoothProvider>
			</DrawerProvider>
		</AuthGuard>
	);
}
