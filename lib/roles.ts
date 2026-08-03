// Role ladder + pure role math for the 5-role model.
//
// Roles (highest → lowest): admin > owner > manager > team_leader > cashier.
//   - admin       : the programmer; owner-level power + the ability to PREVIEW (impersonate) other roles.
//   - owner        : full control, no role switching.
//   - manager      : all-branch operational control (no user/branch governance).
//   - team_leader  : one-branch operational lead (stored as workers.role='team_leader').
//   - cashier      : one-branch POS staff (stored as workers.role='cashier').
//
// This module is side-effect-free so the resolution + hierarchy logic is unit-testable.
// AuthContext wires live profile/assignment state and impersonation into it.

export type EffectiveRole = 'admin' | 'owner' | 'manager' | 'team_leader' | 'cashier';

// The two roles that are stored per-branch in the `workers` table.
export type BranchRole = 'team_leader' | 'cashier';

export const ROLE_RANK: Record<EffectiveRole, number> = {
  admin: 5,
  owner: 4,
  manager: 3,
  team_leader: 2,
  cashier: 1,
};

// Roles an admin may preview. (Admin can't "preview" admin — that's just itself.)
export const PREVIEWABLE_ROLES: readonly EffectiveRole[] = ['owner', 'manager', 'team_leader', 'cashier'] as const;

export type ProfileFlags = {
  is_admin?: boolean;
  is_owner?: boolean;
  is_manager?: boolean;
};

export type AssignmentLike = {
  branchId: string;
  role: BranchRole;
  isActive?: boolean;
};

// The user's real (non-previewed) role — the highest tier their profile/assignments grant.
export function resolveRealRole(flags: ProfileFlags, assignments: AssignmentLike[]): EffectiveRole | null {
  if (flags.is_admin) return 'admin';
  if (flags.is_owner) return 'owner';
  if (flags.is_manager) return 'manager';
  const active = assignments.filter((a) => a.isActive !== false);
  if (active.some((a) => a.role === 'team_leader')) return 'team_leader';
  if (active.some((a) => a.role === 'cashier')) return 'cashier';
  return null;
}

export type Impersonation = {
  assumedRole: EffectiveRole;
  branchId?: string; // required for team_leader/cashier previews
  workerId?: string;
} | null;

// Only admins may preview; while previewing, the effective role is the assumed one.
export function resolveEffectiveRole(realRole: EffectiveRole | null, impersonation: Impersonation): EffectiveRole | null {
  if (realRole === 'admin' && impersonation) return impersonation.assumedRole;
  return realRole;
}

export const canPreviewRoles = (realRole: EffectiveRole | null): boolean => realRole === 'admin';

// Whether `actor` sits strictly above `target` in the ladder.
export function outranks(actor: EffectiveRole | null, target: EffectiveRole): boolean {
  if (!actor) return false;
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

// Who may create/edit/assign a given role. Only owner/admin manage users & roles
// (per product decision); managers do NOT manage users. Owners cannot mint owners
// above themselves — only assigning owner is gated separately (canAssignOwner).
export function canManageRole(actor: EffectiveRole | null, target: EffectiveRole): boolean {
  if (actor !== 'owner' && actor !== 'admin') return false;
  // Governance roles (owner/admin/manager) and branch roles are all assignable by owner/admin,
  // except no one manages an admin through this path.
  return target !== 'admin';
}

// All-branch access: owner/admin/manager operate across every branch; team_leader/cashier
// are scoped to their assigned branches.
export function hasAllBranchAccess(role: EffectiveRole | null): boolean {
  return role === 'admin' || role === 'owner' || role === 'manager';
}
