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

const ROLE_DESCRIPTIONS: Record<EffectiveRole, string> = {
	admin: "Full system access",
	owner: "Full access, every branch",
	manager: "Operational access, every branch",
	team_leader: "Branch lead — scoped to one branch",
	cashier: "POS staff — scoped to one branch",
};

const NEEDS_BRANCH = (role: EffectiveRole) => role === "team_leader" || role === "cashier";

export default function RolePreviewBanner() {
	const { canPreview, previewableRoles, impersonation, startPreview, stopPreview } = useAuth();
	const { allBranches, currentBranch } = useBranch();
	const [open, setOpen] = useState(false);

	if (!canPreview) return null;

	const branchName = (id?: string) => allBranches.find((b) => b.id === id)?.name ?? "—";

	// Team Leader/Cashier are branch-scoped — only previewable while already inside a branch.
	const choose = (role: EffectiveRole) => {
		if (NEEDS_BRANCH(role)) {
			if (!currentBranch) return;
			startPreview(role, { branchId: currentBranch.id });
			setOpen(false);
			return;
		}
		startPreview(role);
		setOpen(false);
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
		<div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end">
			{open && (
				<div className="mb-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
					<div className="border-b border-gray-100 px-3.5 pt-3 pb-2.5">
						<p className="text-3 font-bold text-secondary">Preview as role</p>
						<p className="text-2.5 text-secondary/50">See the app the way another role would</p>
					</div>
					<div className="p-1.5">
						{previewableRoles.map((role) => {
							const disabled = NEEDS_BRANCH(role) && !currentBranch;
							return (
								<button
									key={role}
									type="button"
									disabled={disabled}
									onClick={() => choose(role)}
									className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-light-accent disabled:cursor-not-allowed disabled:hover:bg-transparent"
								>
									<span
										className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
											disabled ? "bg-secondary/20" : "bg-accent"
										}`}
									/>
									<span className="min-w-0">
										<span className={`block text-3 font-semibold ${disabled ? "text-secondary/40" : "text-secondary"}`}>
											{ROLE_LABELS[role]}
										</span>
										<span className={`block text-2.5 ${disabled ? "text-secondary/40" : "text-secondary/50"}`}>
											{disabled ? "Open a branch to preview this role" : ROLE_DESCRIPTIONS[role]}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				</div>
			)}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-2 rounded-full border border-accent/30 bg-secondary px-4 py-2 text-3 font-semibold text-primary shadow-lg transition-opacity hover:opacity-90"
			>
				<span className="size-2 shrink-0 rounded-full bg-accent" />
				Preview role
				<svg
					className={`size-3.5 shrink-0 text-primary/60 transition-transform ${open ? "rotate-180" : ""}`}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
				</svg>
			</button>
		</div>
	);
}
