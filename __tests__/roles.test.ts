import { describe, it, expect } from 'vitest';
import {
  resolveRealRole,
  resolveEffectiveRole,
  canPreviewRoles,
  canManageRole,
  hasAllBranchAccess,
  outranks,
  PREVIEWABLE_ROLES,
  type AssignmentLike,
} from '@/lib/roles';

const tl = (branchId: string, isActive = true): AssignmentLike => ({ branchId, role: 'team_leader', isActive });
const cash = (branchId: string, isActive = true): AssignmentLike => ({ branchId, role: 'cashier', isActive });

// ---------------------------------------------------------------------------
// resolveRealRole — highest tier wins
// ---------------------------------------------------------------------------
describe('resolveRealRole', () => {
  it('admin flag beats everything', () => {
    expect(resolveRealRole({ is_admin: true, is_owner: true, is_manager: true }, [tl('b1')])).toBe('admin');
  });
  it('owner beats manager/branch roles', () => {
    expect(resolveRealRole({ is_owner: true, is_manager: true }, [tl('b1')])).toBe('owner');
  });
  it('manager flag beats branch roles', () => {
    expect(resolveRealRole({ is_manager: true }, [tl('b1')])).toBe('manager');
  });
  it('team_leader beats cashier', () => {
    expect(resolveRealRole({}, [cash('b1'), tl('b2')])).toBe('team_leader');
  });
  it('cashier when only cashier assignments', () => {
    expect(resolveRealRole({}, [cash('b1')])).toBe('cashier');
  });
  it('ignores inactive assignments', () => {
    expect(resolveRealRole({}, [tl('b1', false)])).toBeNull();
  });
  it('null when no flags and no assignments', () => {
    expect(resolveRealRole({}, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveRole — preview only applies to admins
// ---------------------------------------------------------------------------
describe('resolveEffectiveRole', () => {
  it('admin previewing cashier becomes cashier', () => {
    expect(resolveEffectiveRole('admin', { assumedRole: 'cashier', branchId: 'b1' })).toBe('cashier');
  });
  it('non-admin cannot be impersonated (owner stays owner)', () => {
    expect(resolveEffectiveRole('owner', { assumedRole: 'cashier' })).toBe('owner');
  });
  it('admin with no impersonation stays admin', () => {
    expect(resolveEffectiveRole('admin', null)).toBe('admin');
  });
});

describe('canPreviewRoles', () => {
  it('only admins can preview', () => {
    expect(canPreviewRoles('admin')).toBe(true);
    expect(canPreviewRoles('owner')).toBe(false);
    expect(canPreviewRoles(null)).toBe(false);
  });
  it('does not offer admin as a previewable role', () => {
    expect(PREVIEWABLE_ROLES).not.toContain('admin');
    expect([...PREVIEWABLE_ROLES]).toEqual(['owner', 'manager', 'team_leader', 'cashier']);
  });
});

// ---------------------------------------------------------------------------
// canManageRole — owner/admin manage users; managers do not
// ---------------------------------------------------------------------------
describe('canManageRole', () => {
  it('owner can manage non-admin roles', () => {
    for (const r of ['owner', 'manager', 'team_leader', 'cashier'] as const) {
      expect(canManageRole('owner', r)).toBe(true);
    }
  });
  it('admin can manage non-admin roles', () => {
    expect(canManageRole('admin', 'manager')).toBe(true);
  });
  it('no one manages admin through this path', () => {
    expect(canManageRole('owner', 'admin')).toBe(false);
    expect(canManageRole('admin', 'admin')).toBe(false);
  });
  it('manager/team_leader/cashier cannot manage anyone', () => {
    expect(canManageRole('manager', 'cashier')).toBe(false);
    expect(canManageRole('team_leader', 'cashier')).toBe(false);
    expect(canManageRole('cashier', 'cashier')).toBe(false);
    expect(canManageRole(null, 'cashier')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAllBranchAccess / outranks
// ---------------------------------------------------------------------------
describe('hasAllBranchAccess', () => {
  it('true for admin/owner/manager, false for branch roles', () => {
    expect(hasAllBranchAccess('admin')).toBe(true);
    expect(hasAllBranchAccess('owner')).toBe(true);
    expect(hasAllBranchAccess('manager')).toBe(true);
    expect(hasAllBranchAccess('team_leader')).toBe(false);
    expect(hasAllBranchAccess('cashier')).toBe(false);
    expect(hasAllBranchAccess(null)).toBe(false);
  });
});

describe('outranks', () => {
  it('respects the ladder', () => {
    expect(outranks('owner', 'manager')).toBe(true);
    expect(outranks('manager', 'team_leader')).toBe(true);
    expect(outranks('cashier', 'team_leader')).toBe(false);
    expect(outranks('manager', 'manager')).toBe(false);
    expect(outranks(null, 'cashier')).toBe(false);
  });
});
