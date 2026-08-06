import type { EffectiveRole } from "@/lib/roles";
import AdminIcon from "@/components/icons/RoleIcons/AdminIcon";
import OwnerIcon from "@/components/icons/RoleIcons/OwnerIcon";
import ManagerIcon from "@/components/icons/RoleIcons/ManagerIcon";
import TeamLeaderIcon from "@/components/icons/RoleIcons/TeamLeaderIcon";
import CashierIcon from "@/components/icons/RoleIcons/CashierIcon";

// Icons here are temporary placeholders (see components/icons/RoleIcons/*) until a
// final icon set is designed.
const ROLE_META: Record<EffectiveRole, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
	admin: { label: "Admin", Icon: AdminIcon },
	owner: { label: "Owner", Icon: OwnerIcon },
	manager: { label: "Manager", Icon: ManagerIcon },
	team_leader: { label: "Team Leader", Icon: TeamLeaderIcon },
	cashier: { label: "Cashier", Icon: CashierIcon },
};

export default function RoleBadge({ role, variant = "desktop" }: { role: EffectiveRole; variant?: "desktop" | "mobile" }) {
	const meta = ROLE_META[role];
	if (!meta) return null;
	const { label, Icon } = meta;

	if (variant === "mobile") {
		return (
			<div className='flex-1 h-12 px-3 py-2 flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-xs'>
				<span className='w-7 h-7 bg-light-accent rounded-full flex items-center justify-center text-secondary shrink-0'>
					<Icon className='w-4 h-4' />
				</span>
				<span>{label}</span>
			</div>
		);
	}

	return (
		<div className='shrink-0'>
			<div className='h-14 px-3 py-3 text-center flex bg-primary rounded-xl text-secondary gap-2 items-center font-medium text-3 lg:text-3'>
				<span className='w-8 h-8 bg-light-accent rounded-full flex items-center justify-center text-secondary shrink-0'>
					<Icon className='w-4.5 h-4.5' />
				</span>
				<span className='text-secondary font-medium'>{label}</span>
			</div>
		</div>
	);
}
