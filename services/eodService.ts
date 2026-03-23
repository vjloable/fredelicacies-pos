import { eodRepository } from '@/lib/repositories/eodRepository';
import { updateInventoryItem } from '@/services/inventoryService';
import { recordWastage } from '@/services/wastageService';
import { logActivity } from '@/services/activityLogService';
import { categoryEodPolicyRepository } from '@/lib/repositories/categoryEodPolicyRepository';
import { log, measureTime } from '@/lib/logging';
import type { EodItemLock, EodSession, EodDailySummary } from '@/types/domain/eod';
import type { InventoryItem } from '@/types/domain/inventory';

// ---------------------------------------------------------------------------
// Lock / Unlock
// ---------------------------------------------------------------------------

export async function lockItem(
  branchId: string,
  userId: string | null,
  item: Pick<InventoryItem, 'id' | 'name' | 'stock'>,
  expectedStock: number,
  resolution?: { type: 'force_carryover' | 'force_wastage'; reason?: string }
): Promise<{ lock: EodItemLock | null; error: any }> {
  const today = new Date().toISOString().slice(0, 10);

  log.info('EOD: Locking item', {
    branchId,
    userId,
    itemId: item.id,
    itemName: item.name,
    expectedStock,
    lockedStock: item.stock,
    discrepancy: item.stock - expectedStock,
  });

  // Ensure session exists
  const { session, error: sessionError } = await eodRepository.getOrCreateSession(
    branchId,
    today,
    userId
  );
  if (sessionError || !session) {
    log.error('EOD: Failed to get or create session', new Error(sessionError?.message || 'Unknown'), {
      branchId,
      userId,
      today,
    });
    return { lock: null, error: sessionError };
  }

  const { lock, error } = await eodRepository.upsertItemLock({
    session_id: session.id,
    branch_id: branchId,
    audit_date: today,
    item_id: item.id,
    item_name: item.name,
    expected_stock: expectedStock,
    locked_stock: item.stock,
    resolution: resolution?.type,
    resolution_reason: resolution?.reason,
    locked_by: userId,
  });

  if (error) {
    log.error('EOD: Failed to lock item', new Error(error?.message || 'Unknown'), {
      branchId,
      userId,
      itemId: item.id,
      itemName: item.name,
    });
    return { lock, error };
  }

  log.info('EOD: Item locked successfully', {
    branchId,
    userId,
    itemId: item.id,
    itemName: item.name,
    lockId: lock?.id,
  });

  void logActivity({
    branchId,
    userId,
    action: 'eod_lock_item',
    entityType: 'inventory',
    entityId: item.id,
    details: {
      item_name: item.name,
      expected_stock: expectedStock,
      locked_stock: item.stock,
      discrepancy: item.stock - expectedStock,
      resolution: resolution?.type ?? null,
    },
  });

  return { lock, error };
}

export async function unlockItem(
  branchId: string,
  userId: string | null,
  lock: EodItemLock
): Promise<{ error: any }> {
  log.info('EOD: Unlocking item', {
    branchId,
    userId,
    lockId: lock.id,
    itemId: lock.item_id,
    itemName: lock.item_name,
  });

  const { error } = await eodRepository.deleteItemLock(lock.id);

  if (error) {
    log.error('EOD: Failed to unlock item', new Error(error?.message || 'Unknown'), {
      branchId,
      userId,
      lockId: lock.id,
      itemName: lock.item_name,
    });
    return { error };
  }

  log.info('EOD: Item unlocked successfully', {
    branchId,
    userId,
    lockId: lock.id,
    itemName: lock.item_name,
  });

  void logActivity({
    branchId,
    userId,
    action: 'eod_unlock_item',
    entityType: 'inventory',
    entityId: lock.item_id ?? undefined,
    details: { item_name: lock.item_name },
  });

  return { error };
}

// ---------------------------------------------------------------------------
// Submit EOD — carry-over all locked items
// ---------------------------------------------------------------------------

export async function submitEOD(
  branchId: string,
  userId: string | null,
  sessionId: string,
  locks: EodItemLock[]
): Promise<{ error: any }> {
  const timer = measureTime();
  const today = new Date().toISOString().slice(0, 10);
  let forceWastageTotalCost = 0;

  log.info('EOD: Submission started', {
    branchId,
    userId,
    sessionId,
    itemsLocked: locks.length,
    itemsWithDiscrepancy: locks.filter(l => l.discrepancy !== 0).length,
  });

  try {
    for (const lock of locks) {
      // Carry-over: set inventory stock to the locked count
      if (lock.item_id) {
        await updateInventoryItem(lock.item_id, { stock: lock.locked_stock });
        log.info('EOD: Inventory stock updated', {
          branchId,
          itemId: lock.item_id,
          itemName: lock.item_name,
          newStock: lock.locked_stock,
        });
      }

      // For force_wastage resolution: log the discrepancy as wastage
      if (lock.resolution === 'force_wastage' && lock.discrepancy !== 0 && lock.item_id) {
        const wastageQty = Math.abs(lock.discrepancy);
        // cost_per_unit: we don't have it here so we use 0 (item cost not stored on lock)
        // The wastage record is still useful for audit trail purposes
        await recordWastage(branchId, userId, [
          {
            item_id: lock.item_id,
            item_name: lock.item_name,
            quantity_wasted: wastageQty,
            cost_per_unit: 0,
            wastage_date: today,
          },
        ]);
        log.info('EOD: Discrepancy recorded as wastage', {
          branchId,
          itemId: lock.item_id,
          itemName: lock.item_name,
          wastedQty: wastageQty,
        });
        forceWastageTotalCost += wastageQty;
      }
    }

    // Mark all locks as submitted
    await eodRepository.submitAllLocks(sessionId);

    // Mark session as submitted
    const { error } = await eodRepository.submitSession(sessionId, userId);

    if (error) {
      log.error('EOD: Submission failed at session update', new Error(error?.message || 'Unknown'), {
        branchId,
        userId,
        sessionId,
      });
      return { error };
    }

    const duration = timer.duration();
    log.info('EOD: Submission completed successfully', {
      branchId,
      userId,
      sessionId,
      auditDate: today,
      itemsSubmitted: locks.length,
      itemsWithDiscrepancy: locks.filter(l => l.discrepancy !== 0).length,
      forceWastageQty: forceWastageTotalCost,
      duration,
    });

    void logActivity({
      branchId,
      userId,
      action: 'eod_submit',
      entityType: 'eod_session',
      entityId: sessionId,
      details: {
        audit_date: today,
        items_submitted: locks.length,
        items_with_discrepancy: locks.filter(l => l.discrepancy !== 0).length,
        force_wastage_qty: forceWastageTotalCost,
      },
    });

    return { error: null };
  } catch (err) {
    log.error('EOD: Submission failed', err as Error, {
      branchId,
      userId,
      sessionId,
    });
    return { error: err };
  }
}

// ---------------------------------------------------------------------------
// Flag uncarried items — called after EOD submit
// Items in carryover categories that were NOT locked get flagged
// ---------------------------------------------------------------------------

export async function flagUncarriedItems(
  branchId: string,
  userId: string | null,
  lockedItemIds: Set<string>,
  allItems: InventoryItem[]
): Promise<{ flaggedCount: number; error: any }> {
  try {
    // Get EOD policies for this branch
    const { policies } = await categoryEodPolicyRepository.getByBranch(branchId);

    // Build a set of carryover category IDs (only explicitly selected ones)
    const carryoverCategoryIds = new Set(
      policies.filter(p => p.eod_policy === 'carryover').map(p => p.category_id)
    );

    // Find items in carryover categories that were NOT locked and have stock > 0
    const uncarriedItems = allItems.filter(item => {
      if (lockedItemIds.has(item.id)) return false; // already locked
      if (item.stock <= 0) return false; // no stock to carry over
      if (!item.category_id || !carryoverCategoryIds.has(item.category_id)) return false; // not a carryover category
      return true;
    });

    // Flag each item by setting uncarried_stock
    for (const item of uncarriedItems) {
      await updateInventoryItem(item.id, { uncarried_stock: item.stock });

      void logActivity({
        branchId,
        userId,
        action: 'eod_flag_uncarried',
        entityType: 'inventory',
        entityId: item.id,
        details: {
          item_name: item.name,
          uncarried_stock: item.stock,
          reason: 'Item was not locked during EOD',
        },
      });
    }

    log.info('EOD: Flagged uncarried items', {
      branchId,
      userId,
      flaggedCount: uncarriedItems.length,
      flaggedItems: uncarriedItems.map(i => i.name),
    });

    return { flaggedCount: uncarriedItems.length, error: null };
  } catch (err) {
    log.error('EOD: Failed to flag uncarried items', err as Error, { branchId });
    return { flaggedCount: 0, error: err };
  }
}

// ---------------------------------------------------------------------------
// Resolve uncarried stock — carry over or destock
// ---------------------------------------------------------------------------

export async function resolveUncarried(
  branchId: string,
  userId: string | null,
  items: InventoryItem[],
  resolution: 'carry_over' | 'destock'
): Promise<{ error: any }> {
  try {
    for (const item of items) {
      if (resolution === 'carry_over') {
        // Accept the old stock as valid — just clear the uncarried flag
        await updateInventoryItem(item.id, { uncarried_stock: 0 });

        void logActivity({
          branchId,
          userId,
          action: 'resolve_carryover',
          entityType: 'inventory',
          entityId: item.id,
          details: {
            item_name: item.name,
            uncarried_stock: item.uncarried_stock,
            resolution: 'carried_over',
            usable_stock_after: item.stock,
          },
        });
      } else {
        // Destock the uncarried portion
        const newStock = item.stock - item.uncarried_stock;
        await updateInventoryItem(item.id, {
          stock: Math.max(0, newStock),
          uncarried_stock: 0,
        });

        // Record wastage for the destocked portion
        if (item.uncarried_stock > 0) {
          await recordWastage(branchId, userId, [
            {
              item_id: item.id,
              item_name: item.name,
              quantity_wasted: item.uncarried_stock,
              cost_per_unit: item.price ?? 0,
              wastage_date: new Date().toISOString().slice(0, 10),
            },
          ]);
        }

        void logActivity({
          branchId,
          userId,
          action: 'resolve_destock',
          entityType: 'inventory',
          entityId: item.id,
          details: {
            item_name: item.name,
            uncarried_stock: item.uncarried_stock,
            resolution: 'destocked',
            usable_stock_after: Math.max(0, newStock),
            wastage_recorded: true,
          },
        });
      }
    }

    log.info('EOD: Resolved uncarried items', {
      branchId,
      userId,
      resolution,
      count: items.length,
      items: items.map(i => i.name),
    });

    return { error: null };
  } catch (err) {
    log.error('EOD: Failed to resolve uncarried items', err as Error, { branchId });
    return { error: err };
  }
}

// ---------------------------------------------------------------------------
// Read — today's locks (thin wrapper)
// ---------------------------------------------------------------------------

export async function getEodLocks(
  branchId: string,
  date: string
): Promise<{ locks: EodItemLock[]; session: EodSession | null; error: any }> {
  const [locksResult, sessionResult] = await Promise.all([
    eodRepository.getItemLocks(branchId, date),
    eodRepository.getSession(branchId, date),
  ]);

  return {
    locks: locksResult.locks,
    session: sessionResult.session,
    error: locksResult.error ?? sessionResult.error,
  };
}

// Subscribe to realtime lock changes
export function subscribeToEodLocks(
  branchId: string,
  date: string,
  callback: (locks: EodItemLock[]) => void
): () => void {
  return eodRepository.subscribe(branchId, date, callback);
}

// ---------------------------------------------------------------------------
// Read — aggregated summaries for the sales page
// ---------------------------------------------------------------------------

export async function getEodSummary(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<{ data: EodDailySummary[]; sessions: EodSession[]; error: any }> {
  const [locksResult, sessionsResult] = await Promise.all([
    eodRepository.getItemLocksRange(branchId, startDate, endDate),
    supabaseGetSessions(branchId, startDate, endDate),
  ]);

  if (locksResult.error) return { data: [], sessions: [], error: locksResult.error };

  // Build a map of sessions by date
  const sessionByDate = new Map<string, EodSession>();
  for (const s of sessionsResult.sessions) {
    sessionByDate.set(s.audit_date, s);
  }

  // Aggregate locks by date
  const byDate = new Map<string, EodDailySummary>();
  for (const lock of locksResult.locks) {
    const existing = byDate.get(lock.audit_date);
    const disc = Math.abs(lock.discrepancy);
    const hasDisc = lock.discrepancy !== 0;
    if (existing) {
      existing.items_locked += 1;
      existing.total_discrepancy_units += disc;
      if (hasDisc) existing.items_with_discrepancy += 1;
    } else {
      byDate.set(lock.audit_date, {
        date: lock.audit_date,
        items_locked: 1,
        items_with_discrepancy: hasDisc ? 1 : 0,
        total_discrepancy_units: disc,
        session_status: sessionByDate.get(lock.audit_date)?.status ?? null,
      });
    }
  }

  return {
    data: Array.from(byDate.values()),
    sessions: sessionsResult.sessions,
    error: null,
  };
}

// Internal helper to fetch sessions for a date range
async function supabaseGetSessions(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<{ sessions: EodSession[] }> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase
    .from('eod_sessions')
    .select('*')
    .eq('branch_id', branchId)
    .gte('audit_date', startDate)
    .lte('audit_date', endDate);

  return { sessions: (data ?? []) as EodSession[] };
}
