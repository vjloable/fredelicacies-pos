"use client";
import AuthGuard from "@/components/AuthGuard";
import { BluetoothProvider } from "@/contexts/BluetoothContext";
import { BranchProvider } from "@/contexts/BranchContext";
import DrawerProvider from "@/components/DrawerProvider";

interface AttendanceLayoutProps {
	children: React.ReactNode;
}

// Outside any branch: face attendance is company-wide. The page itself limits
// access to admins, owners and managers (the same people face_access lets manage).
export default function AttendanceLayout({ children }: AttendanceLayoutProps) {
	return (
		<AuthGuard>
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
