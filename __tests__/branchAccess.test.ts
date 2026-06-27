import { describe, it, expect } from 'vitest';
import {
  getAccessibleBranches,
  canAccessBranch,
  getUserRoleInBranch,
  canManageWorkersInBranch,
  canManageWorker,
  filterAccessibleWorkers,
  requiresClockInForPOS,
  getDefaultBranch,
  getBranchAccessSummary,
} from '@/utils/branchAccess';
import type { Branch } from '@/types/domain';
import type { Worker } from '@/services/workerService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeWorker(overrides: {
  id?: string;
  isOwner?: boolean;
  roleAssignments?: Worker['roleAssignments'];
} = {}): Worker {
  return {
    id: overrides.id ?? 'w-1',
    name: 'Test Worker',
    email: 'test@test.com',
    isOwner: overrides.isOwner ?? false,
    roleAssignments: overrides.roleAssignments ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    isActive: true,
  };
}

function makeAssignment(branchId: string, role: 'manager' | 'worker', isActive = true): Worker['roleAssignments'][number] {
  return {
    workersTableId: 'wt-1',
    branchId,
    role,
    assignedAt: new Date(),
    assignedBy: 'admin',
    isActive,
  };
}

const branches = [
  { id: 'b-1', name: 'Main' },
  { id: 'b-2', name: 'Sub' },
  { id: 'b-3', name: 'Other' },
] as Branch[];

// ---------------------------------------------------------------------------
// getAccessibleBranches
// ---------------------------------------------------------------------------
describe('getAccessibleBranches', () => {
  it('owner gets all branches', () => {
    const owner = makeWorker({ isOwner: true });
    expect(getAccessibleBranches(null, owner, branches)).toEqual(branches);
  });

  it('worker only gets assigned active branches', () => {
    const worker = makeWorker({
      roleAssignments: [
        makeAssignment('b-1', 'worker'),
        makeAssignment('b-2', 'worker', false), // inactive
      ],
    });
    const result = getAccessibleBranches(null, worker, branches);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b-1');
  });

  it('null worker returns empty', () => {
    expect(getAccessibleBranches(null, null, branches)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// canAccessBranch
// ---------------------------------------------------------------------------
describe('canAccessBranch', () => {
  it('owner can access any branch', () => {
    const owner = makeWorker({ isOwner: true });
    expect(canAccessBranch(null, owner, 'b-3')).toBe(true);
  });

  it('worker can access assigned branch', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(canAccessBranch(null, worker, 'b-1')).toBe(true);
  });

  it('worker cannot access unassigned branch', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(canAccessBranch(null, worker, 'b-2')).toBe(false);
  });

  it('inactive assignment denies access', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker', false)] });
    expect(canAccessBranch(null, worker, 'b-1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUserRoleInBranch
// ---------------------------------------------------------------------------
describe('getUserRoleInBranch', () => {
  it('owner is always admin', () => {
    const owner = makeWorker({ isOwner: true });
    expect(getUserRoleInBranch(owner, 'b-1')).toBe('admin');
  });

  it('returns manager role', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'manager')] });
    expect(getUserRoleInBranch(worker, 'b-1')).toBe('manager');
  });

  it('returns worker role', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(getUserRoleInBranch(worker, 'b-1')).toBe('worker');
  });

  it('returns null for unassigned branch', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(getUserRoleInBranch(worker, 'b-999')).toBeNull();
  });

  it('returns null for null worker', () => {
    expect(getUserRoleInBranch(null, 'b-1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// canManageWorkersInBranch
// ---------------------------------------------------------------------------
describe('canManageWorkersInBranch', () => {
  it('admin (owner) can manage', () => {
    const owner = makeWorker({ isOwner: true });
    expect(canManageWorkersInBranch(null, owner, 'b-1')).toBe(true);
  });

  it('manager can manage', () => {
    const mgr = makeWorker({ roleAssignments: [makeAssignment('b-1', 'manager')] });
    expect(canManageWorkersInBranch(null, mgr, 'b-1')).toBe(true);
  });

  it('worker cannot manage', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(canManageWorkersInBranch(null, worker, 'b-1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canManageWorker
// ---------------------------------------------------------------------------
describe('canManageWorker', () => {
  it('owner can manage non-owners', () => {
    const owner = makeWorker({ isOwner: true });
    const target = makeWorker({ id: 'w-2', roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(canManageWorker(owner, target)).toBe(true);
  });

  it('owner cannot manage other owners', () => {
    const owner = makeWorker({ isOwner: true });
    const otherOwner = makeWorker({ id: 'w-2', isOwner: true });
    expect(canManageWorker(owner, otherOwner)).toBe(false);
  });

  it('manager can manage workers in same branch', () => {
    const mgr = makeWorker({
      id: 'm-1',
      roleAssignments: [makeAssignment('b-1', 'manager')],
    });
    const worker = makeWorker({
      id: 'w-2',
      roleAssignments: [makeAssignment('b-1', 'worker')],
    });
    expect(canManageWorker(mgr, worker)).toBe(true);
  });

  it('manager cannot manage workers in different branch', () => {
    const mgr = makeWorker({
      id: 'm-1',
      roleAssignments: [makeAssignment('b-1', 'manager')],
    });
    const worker = makeWorker({
      id: 'w-2',
      roleAssignments: [makeAssignment('b-2', 'worker')],
    });
    expect(canManageWorker(mgr, worker)).toBe(false);
  });

  it('manager cannot manage other managers', () => {
    const mgr = makeWorker({
      id: 'm-1',
      roleAssignments: [makeAssignment('b-1', 'manager')],
    });
    const otherMgr = makeWorker({
      id: 'm-2',
      roleAssignments: [makeAssignment('b-1', 'manager')],
    });
    expect(canManageWorker(mgr, otherMgr)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterAccessibleWorkers
// ---------------------------------------------------------------------------
describe('filterAccessibleWorkers', () => {
  it('owner sees all workers', () => {
    const owner = makeWorker({ isOwner: true });
    const workers = [
      makeWorker({ id: 'w-1' }),
      makeWorker({ id: 'w-2' }),
    ];
    expect(filterAccessibleWorkers(owner, workers)).toHaveLength(2);
  });

  it('manager sees self + workers in their branch', () => {
    const mgr = makeWorker({
      id: 'm-1',
      roleAssignments: [makeAssignment('b-1', 'manager')],
    });
    const sameB = makeWorker({
      id: 'w-2',
      roleAssignments: [makeAssignment('b-1', 'worker')],
    });
    const diffB = makeWorker({
      id: 'w-3',
      roleAssignments: [makeAssignment('b-2', 'worker')],
    });
    const result = filterAccessibleWorkers(mgr, [mgr, sameB, diffB]);
    expect(result.map(w => w.id)).toEqual(['m-1', 'w-2']);
  });

  it('null worker sees nobody', () => {
    expect(filterAccessibleWorkers(null, [makeWorker()])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// requiresClockInForPOS
// ---------------------------------------------------------------------------
describe('requiresClockInForPOS', () => {
  it('owner is exempt', () => {
    const owner = makeWorker({ isOwner: true });
    expect(requiresClockInForPOS(owner, 'b-1')).toBe(false);
  });

  it('null worker is exempt', () => {
    expect(requiresClockInForPOS(null)).toBe(false);
  });

  it('worker with access must clock in', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(requiresClockInForPOS(worker, 'b-1')).toBe(true);
  });

  it('worker without branch access does not need clock in', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(requiresClockInForPOS(worker, 'b-999')).toBe(false);
  });

  it('requires clock in when no branch specified', () => {
    const worker = makeWorker({ roleAssignments: [makeAssignment('b-1', 'worker')] });
    expect(requiresClockInForPOS(worker)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDefaultBranch
// ---------------------------------------------------------------------------
describe('getDefaultBranch', () => {
  it('returns first active assignment', () => {
    const worker = makeWorker({
      roleAssignments: [
        makeAssignment('b-2', 'worker', false),
        makeAssignment('b-1', 'worker'),
      ],
    });
    expect(getDefaultBranch(worker)).toBe('b-1');
  });

  it('returns null for null worker', () => {
    expect(getDefaultBranch(null)).toBeNull();
  });

  it('returns null when no active assignments', () => {
    const worker = makeWorker({
      roleAssignments: [makeAssignment('b-1', 'worker', false)],
    });
    expect(getDefaultBranch(worker)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getBranchAccessSummary
// ---------------------------------------------------------------------------
describe('getBranchAccessSummary', () => {
  it('owner summary shows all branches accessible', () => {
    const owner = makeWorker({ isOwner: true });
    const summary = getBranchAccessSummary(owner, branches);
    expect(summary).toEqual({
      totalBranches: 3,
      accessibleBranches: 3,
      managerBranches: 3,
      workerBranches: 0,
      isOwner: true,
    });
  });

  it('worker summary counts roles correctly', () => {
    const worker = makeWorker({
      roleAssignments: [
        makeAssignment('b-1', 'manager'),
        makeAssignment('b-2', 'worker'),
      ],
    });
    const summary = getBranchAccessSummary(worker, branches);
    expect(summary).toEqual({
      totalBranches: 3,
      accessibleBranches: 2,
      managerBranches: 1,
      workerBranches: 1,
      isOwner: false,
    });
  });

  it('null worker has no access', () => {
    const summary = getBranchAccessSummary(null, branches);
    expect(summary.accessibleBranches).toBe(0);
    expect(summary.isOwner).toBe(false);
  });
});
