"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { canManageFaceAttendance } from "@/lib/roles";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import PageLoader from "@/components/PageLoader";
import AttendanceIcon from "@/components/icons/SidebarNav/AttendanceIcon";
import StaffAttendanceView from "./components/StaffAttendanceView";
import { Icon } from "./components/ui";

// Company-wide face attendance (kiosk staff list, face enrollment, time records,
// tablets). Open to admins, owners and managers, matching face_access().can_manage
// on the face service. Team leaders and cashiers can't open it.
export default function AttendancePage() {
	const { effectiveRole, loading } = useAuth();

	return (
		<div className='flex h-full overflow-hidden'>
			<div className='flex flex-col flex-1 h-full overflow-hidden'>
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Attendance' icon={<AttendanceIcon className='w-8 h-8' />} />
				</div>
				<div className='hidden xl:block w-full'>
					<TopBar title='Attendance' icon={<AttendanceIcon className='w-8 h-8' />} />
				</div>

				<div className='flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-10'>
					{loading ? (
						<PageLoader text='Loading attendance…' />
					) : !canManageFaceAttendance(effectiveRole) ? (
						<div className='max-w-md mx-auto mt-16 bg-white rounded-xl border border-secondary/10 p-8 text-center'>
							<span className='w-12 h-12 mx-auto mb-3 rounded-full bg-secondary/5 text-secondary/50 flex items-center justify-center'>
								<Icon.Shield className='w-6 h-6' />
							</span>
							<h2 className='font-bold text-secondary text-4.5'>No access</h2>
							<p className='text-3.5 text-secondary/60 mt-1 mb-5'>
								Staff attendance, face enrollment and kiosk tablets are managed by admins, owners and managers.
							</p>
							<Link href='/' className='text-3.5 font-semibold text-accent hover:underline'>
								Go back
							</Link>
						</div>
					) : (
						<div className='max-w-6xl'>
							<p className='text-3 text-secondary/60 mb-4 max-w-2xl'>
								Company-wide: every staff member and kiosk tablet across all branches. Each time in and out records the
								tablet used and its location.
							</p>
							<StaffAttendanceView />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
