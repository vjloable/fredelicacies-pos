"use client";

// Admin-only role-preview control (impersonation).
//
// Renders nothing unless the signed-in user is a true Admin. When idle it shows a
// compact "Preview role" launcher; while a preview is active it shows a persistent
// banner naming the assumed role (and branch, for team_leader/cashier) with a one-click
// exit. Previews are real impersonation: the app behaves as the assumed role and writes
// are audited against the real admin (see AuthContext + logActivity). Owner/Manager are
// all-branch; Team Leader/Cashier require a branch, chosen here from the branch list.
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import type { EffectiveRole } from "@/lib/roles";

const ROLE_LABELS: Record<EffectiveRole, string> = {
	admin: "Admin",
	owner: "Owner",
	manager: "Manager",
	team_leader: "Team Leader",
	cashier: "Cashier",
};

const NEEDS_BRANCH = (role: EffectiveRole) => role === "team_leader" || role === "cashier";

export default function RolePreviewBanner() {
	const { canPreview, previewableRoles, impersonation, startPreview, stopPreview } = useAuth();
	const { allBranches } = useBranch();
	const [open, setOpen] = useState(false);
	const [pendingRole, setPendingRole] = useState<EffectiveRole | null>(null);

	if (!canPreview) return null;

	const branchName = (id?: string) => allBranches.find((b) => b.id === id)?.name ?? "—";

	const choose = (role: EffectiveRole) => {
		if (NEEDS_BRANCH(role)) {
			// Two-step: pick the role, then a branch.
			setPendingRole(role);
			return;
		}
		startPreview(role);
		setOpen(false);
		setPendingRole(null);
	};

	const chooseBranch = (branchId: string) => {
		if (!pendingRole) return;
		startPreview(pendingRole, { branchId });
		setOpen(false);
		setPendingRole(null);
	};

	// Active preview → persistent banner.
	if (impersonation) {
		return (
			<div className="fixed bottom-4 left-1/2 z-[80] -translate-x-1/2">
				<div className="flex items-center gap-3 rounded-full border border-accent/30 bg-secondary px-4 py-2 shadow-lg">
					<span className="size-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
					<span className="text-3 font-medium text-primary">
						Previewing as <span className="font-bold">{ROLE_LABELS[impersonation.assumedRole]}</span>
						{impersonation.branchId && (
							<span className="text-primary/70"> · {branchName(impersonation.branchId)}</span>
						)}
					</span>
					<button
						type="button"
						onClick={stopPreview}
						className="rounded-full bg-accent px-3 py-1 text-3 font-semibold text-primary transition-opacity hover:opacity-90"
					>
						Exit preview
					</button>
				</div>
			</div>
		);
	}

	// Idle → launcher + menu.
	return (
		<div className="fixed bottom-4 right-4 z-[80]">
			{open && (
				<div className="mb-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
					{pendingRole ? (
						<div className="p-2">
							<div className="px-2 py-1.5 text-2.5 font-semibold text-secondary/60">
								{ROLE_LABELS[pendingRole]} — pick a branch
							</div>
							<div className="max-h-56 overflow-y-auto">
								{allBranches.length === 0 && (
									<div className="px-2 py-2 text-3 text-secondary/50">No branches available</div>
								)}
								{allBranches.map((b) => (
									<button
										key={b.id}
										type="button"
										onClick={() => chooseBranch(b.id)}
										className="block w-full rounded-lg px-2 py-2 text-left text-3 text-secondary hover:bg-light-accent"
									>
										{b.name}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={() => setPendingRole(null)}
								className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-2.5 text-secondary/50 hover:bg-gray-50"
							>
								← Back
							</button>
						</div>
					) : (
						<div className="p-2">
							<div className="px-2 py-1.5 text-2.5 font-semibold text-secondary/60">Preview as role</div>
							{previewableRoles.map((role) => (
								<button
									key={role}
									type="button"
									onClick={() => choose(role)}
									className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-3 text-secondary hover:bg-light-accent"
								>
									<span>{ROLE_LABELS[role]}</span>
									{NEEDS_BRANCH(role) && <span className="text-2.5 text-secondary/40">pick branch ›</span>}
								</button>
							))}
						</div>
					)}
				</div>
			)}
			<button
				type="button"
				onClick={() => {
					setOpen((v) => !v);
					setPendingRole(null);
				}}
				className="flex items-center gap-2 rounded-full border border-accent/30 bg-secondary px-4 py-2 text-3 font-semibold text-primary shadow-lg transition-opacity hover:opacity-90"
			>
				<span className="size-2 shrink-0 rounded-full bg-accent" />
				Preview role
			</button>
		</div>
	);
}
