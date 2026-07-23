// Cross-branch inventory transfer service.
// See plan: /Users/vincejaphethloable/.claude/plans/help-plan-out-the-eager-nest.md
//
// Push:  source manager creates → reserves source stock → status=sent, fulfilled_at=NOW.
// Pull:  destination manager creates → status=sent, fulfilled_at=null (no reservation yet).
//        Source manager later "fulfills" → reserves source stock → fulfilled_at=NOW.
// Receive: dest enters per-line counts, optionally resolving missing destination_item_id.
//          settle RPC drops source.stock (qty_sent) + reserved + adds dest.stock (qty_received).
// Cancel: if reservation was placed, release it; status=cancelled.

import { supabase } from '@/lib/supabase';
import { transferRepository, inventoryRepository } from '@/lib/repositories';
import { log, measureTime } from '@/lib/logging';
import { logActivity } from '@/services/activityLogService';
import type {
  TransferWithItems,
  TransferStatus,
  TransferDirection,
  CreatePushTransferData,
  CreatePullRequestData,
  SettleLineCount,
} from '@/types/domain/transfer';
import type { InventoryItem } from '@/types/domain';

async function generateTransferNumber(branchId: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_transfer_number', { p_branch_id: branchId });
  if (error || !data) {
    return `TRN-${Date.now()}`;
  }
  return data as string;
}

// Snapshot helper: capture name/cost/price/category names for each line at create time.
async function snapshotLines(
  itemIds: string[]
): Promise<{ map: Map<string, { name: string; cost: number | null; price: number | null; categories: string[] }>; error: any }> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, cost, price, inventory_item_categories(category_id), categories!inventory_items_category_id_fkey(name)')
    .in('id', itemIds);

  if (error) return { map: new Map(), error };

  const categoryIdsForLookup = new Set<string>();
  for (const row of data || []) {
    for (const link of (row as any).inventory_item_categories ?? []) {
      categoryIdsForLookup.add(link.category_id);
    }
  }

  let categoryNameById = new Map<string, string>();
  if (categoryIdsForLookup.size > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', Array.from(categoryIdsForLookup));
    categoryNameById = new Map((cats || []).map((c: any) => [c.id, c.name]));
  }

  const map = new Map<
    string,
    { name: string; cost: number | null; price: number | null; categories: string[] }
  >();
  for (const row of data || []) {
    const r = row as any;
    const names: string[] = [];
    for (const link of r.inventory_item_categories ?? []) {
      const n = categoryNameById.get(link.category_id);
      if (n && !names.includes(n)) names.push(n);
    }
    if (r.categories?.name && !names.includes(r.categories.name)) names.unshift(r.categories.name);
    map.set(r.id, {
      name: r.name,
      cost: r.cost ?? null,
      price: r.price ?? null,
      categories: names,
    });
  }

  return { map, error: null };
}

// Central transfer-eligibility guard. The commissary is the universal producer — it only
// ships inventory OUT, so it can never be a transfer destination. Guards both entry points
// regardless of what the UI sent.
async function assertTransferAllowed(_sourceId: string, destId: string): Promise<Error | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, type')
    .eq('id', destId);
  if (error) return error;

  if ((data ?? []).some(b => b.type === 'commissary')) {
    return new Error('The commissary only sends inventory — it cannot receive transfers.');
  }
  return null;
}

export async function createPushTransfer(
  userId: string,
  data: CreatePushTransferData
): Promise<{ id: string | null; error: any }> {
  const timer = measureTime();
  log.info('createPushTransfer started', {
    userId,
    sourceBranch: data.source_branch_id,
    destinationBranch: data.destination_branch_id,
    items: data.items.length,
  });

  if (data.source_branch_id === data.destination_branch_id) {
    return { id: null, error: new Error('Source and destination branches must differ') };
  }
  if (data.items.length === 0) {
    return { id: null, error: new Error('At least one line item is required') };
  }

  const guardErr = await assertTransferAllowed(data.source_branch_id, data.destination_branch_id);
  if (guardErr) return { id: null, error: guardErr };

  const { map: snapshot, error: snapErr } = await snapshotLines(
    data.items.map(i => i.source_item_id)
  );
  if (snapErr) return { id: null, error: snapErr };

  const transferNumber = await generateTransferNumber(data.source_branch_id);

  const { transfer, error } = await transferRepository.create(
    {
      transfer_number: transferNumber,
      source_branch_id: data.source_branch_id,
      destination_branch_id: data.destination_branch_id,
      direction: 'push',
      created_by: userId,
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: userId,
      note: data.note ?? null,
    },
    data.items.map(line => {
      const snap = snapshot.get(line.source_item_id);
      return {
        source_item_id: line.source_item_id,
        item_name: snap?.name ?? 'Unknown item',
        item_cost: snap?.cost ?? null,
        item_price: snap?.price ?? null,
        category_names: snap?.categories ?? [],
        quantity_sent: line.quantity_sent,
      };
    })
  );

  if (error || !transfer) {
    log.error('createPushTransfer failed at insert', new Error(error?.message ?? 'unknown'), { userId });
    return { id: null, error };
  }

  // Reserve source stock atomically.
  const { error: reserveErr } = await supabase.rpc('transfer_reserve', { p_transfer_id: transfer.id });
  if (reserveErr) {
    // Rollback header.
    await supabase.from('transfers').delete().eq('id', transfer.id);
    log.error('transfer_reserve failed (push rolled back)', new Error(reserveErr.message), {
      userId,
      transferId: transfer.id,
    });
    return { id: null, error: reserveErr };
  }

  await inventoryRepository.triggerRefresh(data.source_branch_id);

  void logActivity({
    branchId: data.source_branch_id,
    userId,
    action: 'transfer_created',
    entityType: 'transfer',
    entityId: transfer.id,
    details: {
      direction: 'push' as TransferDirection,
      transfer_number: transfer.transfer_number,
      destination_branch_id: data.destination_branch_id,
      lines: data.items.length,
    },
  });

  log.info('createPushTransfer ok', {
    userId,
    transferId: transfer.id,
    duration: timer.duration(),
  });
  return { id: transfer.id, error: null };
}

export async function createPullRequest(
  userId: string,
  data: CreatePullRequestData
): Promise<{ id: string | null; error: any }> {
  log.info('createPullRequest started', { userId, ...data, items: data.items.length });

  if (data.source_branch_id === data.destination_branch_id) {
    return { id: null, error: new Error('Source and destination branches must differ') };
  }
  if (data.items.length === 0) {
    return { id: null, error: new Error('At least one line item is required') };
  }

  // A pull makes the requester the destination — so the commissary can never pull, and a
  // branch can only pull from the commissary (not from the main branch).
  const guardErr = await assertTransferAllowed(data.source_branch_id, data.destination_branch_id);
  if (guardErr) return { id: null, error: guardErr };

  const { map: snapshot, error: snapErr } = await snapshotLines(
    data.items.map(i => i.source_item_id)
  );
  if (snapErr) return { id: null, error: snapErr };

  // Use destination branch's counter for transfer_number on pulls.
  const transferNumber = await generateTransferNumber(data.destination_branch_id);

  const { transfer, error } = await transferRepository.create(
    {
      transfer_number: transferNumber,
      source_branch_id: data.source_branch_id,
      destination_branch_id: data.destination_branch_id,
      direction: 'pull',
      created_by: userId,
      fulfilled_at: null,
      fulfilled_by: null,
      note: data.note ?? null,
    },
    data.items.map(line => {
      const snap = snapshot.get(line.source_item_id);
      return {
        source_item_id: line.source_item_id,
        item_name: snap?.name ?? 'Unknown item',
        item_cost: snap?.cost ?? null,
        item_price: snap?.price ?? null,
        category_names: snap?.categories ?? [],
        quantity_sent: line.quantity_sent,
      };
    })
  );

  if (error || !transfer) {
    return { id: null, error };
  }

  void logActivity({
    branchId: data.destination_branch_id,
    userId,
    action: 'transfer_created',
    entityType: 'transfer',
    entityId: transfer.id,
    details: {
      direction: 'pull' as TransferDirection,
      transfer_number: transfer.transfer_number,
      source_branch_id: data.source_branch_id,
      lines: data.items.length,
    },
  });

  return { id: transfer.id, error: null };
}

export async function fulfillPullRequest(
  userId: string,
  transferId: string,
  options?: {
    // Per-line amounts the source can actually give. A line set to 0 is dropped entirely.
    // Omit to fulfil the request exactly as asked.
    adjustments?: { transfer_item_id: string; quantity: number }[];
    // Short reason shown to the requester when giving less than asked.
    note?: string;
  }
): Promise<{ error: any }> {
  log.info('fulfillPullRequest started', { userId, transferId, adjusted: options?.adjustments?.length ?? 0 });

  // Ensure it's a pull awaiting fulfillment.
  const { transfer, error: getErr } = await transferRepository.getById(transferId);
  if (getErr || !transfer) return { error: getErr ?? new Error('Transfer not found') };
  if (transfer.direction !== 'pull') return { error: new Error('Not a pull request') };
  if (transfer.status !== 'sent') return { error: new Error(`Cannot fulfill in status ${transfer.status}`) };
  if (transfer.fulfilled_at) return { error: new Error('Already fulfilled') };

  // Apply partial-fulfillment adjustments before reserving so the reservation matches what's
  // actually being sent. A zero (or negative) quantity removes the line.
  if (options?.adjustments && options.adjustments.length > 0) {
    for (const adj of options.adjustments) {
      if (adj.quantity <= 0) {
        const { error: delErr } = await supabase
          .from('transfer_items')
          .delete()
          .eq('id', adj.transfer_item_id)
          .eq('transfer_id', transferId);
        if (delErr) return { error: delErr };
      } else {
        const { error: updErr } = await supabase
          .from('transfer_items')
          .update({ quantity_sent: adj.quantity })
          .eq('id', adj.transfer_item_id)
          .eq('transfer_id', transferId);
        if (updErr) return { error: updErr };
      }
    }
    const { count } = await supabase
      .from('transfer_items')
      .select('id', { count: 'exact', head: true })
      .eq('transfer_id', transferId);
    if (!count) {
      return { error: new Error('At least one item must be fulfilled. To reject the whole request, decline it instead.') };
    }
  }

  // Reserve source stock (now reflects any adjusted quantities).
  const { error: reserveErr } = await supabase.rpc('transfer_reserve', { p_transfer_id: transferId });
  if (reserveErr) return { error: reserveErr };

  const nowIso = new Date().toISOString();
  const { error } = await transferRepository.updateStatus(transferId, {
    fulfilled_at: nowIso,
    fulfilled_by: userId,
    fulfill_note: options?.note?.trim() || null,
  });

  if (!error) {
    await inventoryRepository.triggerRefresh(transfer.source_branch_id);
    void logActivity({
      branchId: transfer.source_branch_id,
      userId,
      action: 'transfer_fulfilled',
      entityType: 'transfer',
      entityId: transferId,
      details: {
        transfer_number: transfer.transfer_number,
        partial: !!(options?.adjustments && options.adjustments.length > 0),
        note: options?.note?.trim() || null,
      },
    });
  }
  return { error };
}

export async function receiveTransfer(
  userId: string,
  transferId: string,
  lineCounts: SettleLineCount[]
): Promise<{ error: any }> {
  log.info('receiveTransfer started', { userId, transferId, lines: lineCounts.length });

  const { transfer, error: getErr } = await transferRepository.getById(transferId);
  if (getErr || !transfer) return { error: getErr ?? new Error('Transfer not found') };
  if (transfer.status !== 'sent') return { error: new Error(`Cannot receive in status ${transfer.status}`) };
  if (transfer.direction === 'pull' && !transfer.fulfilled_at) {
    return { error: new Error('Pull request not yet fulfilled by source') };
  }

  for (const line of lineCounts) {
    if (!line.destination_item_id) {
      return { error: new Error('Every line must have a resolved destination_item_id before settling') };
    }
  }

  const { error } = await supabase.rpc('transfer_settle', {
    p_transfer_id: transferId,
    p_line_counts: lineCounts,
  });
  if (error) return { error };

  await inventoryRepository.triggerRefresh(transfer.source_branch_id);
  await inventoryRepository.triggerRefresh(transfer.destination_branch_id);

  const discrepancyLines = transfer.items
    .map(it => {
      const lc = lineCounts.find(l => l.transfer_item_id === it.id);
      if (!lc) return null;
      const diff = it.quantity_sent - lc.quantity_received;
      return diff > 0 ? { item: it.item_name, diff } : null;
    })
    .filter(Boolean);

  void logActivity({
    branchId: transfer.destination_branch_id,
    userId,
    action: 'transfer_received',
    entityType: 'transfer',
    entityId: transferId,
    details: {
      transfer_number: transfer.transfer_number,
      direction: transfer.direction,
      discrepancy_lines: discrepancyLines.length,
      discrepancies: discrepancyLines,
    },
  });

  return { error: null };
}

export async function cancelTransfer(
  userId: string,
  transferId: string,
  reason: string
): Promise<{ error: any }> {
  log.info('cancelTransfer started', { userId, transferId, reason });

  const { transfer, error: getErr } = await transferRepository.getById(transferId);
  if (getErr || !transfer) return { error: getErr ?? new Error('Transfer not found') };
  if (transfer.status !== 'sent') return { error: new Error(`Cannot cancel in status ${transfer.status}`) };

  // Release reservation if one was placed (i.e. push always; pull only after fulfill).
  const reservationPlaced = transfer.direction === 'push' || !!transfer.fulfilled_at;
  if (reservationPlaced) {
    const { error: relErr } = await supabase.rpc('transfer_release_reservation', {
      p_transfer_id: transferId,
    });
    if (relErr) return { error: relErr };
  }

  const nowIso = new Date().toISOString();
  const { error } = await transferRepository.updateStatus(transferId, {
    status: 'cancelled',
    cancelled_at: nowIso,
    cancelled_by: userId,
    cancel_reason: reason.trim() || null,
  });

  if (!error) {
    if (reservationPlaced) {
      await inventoryRepository.triggerRefresh(transfer.source_branch_id);
    }
    void logActivity({
      branchId: transfer.source_branch_id,
      userId,
      action: 'transfer_cancelled',
      entityType: 'transfer',
      entityId: transferId,
      details: {
        transfer_number: transfer.transfer_number,
        reason: reason.trim() || null,
        reservation_released: reservationPlaced,
      },
    });
  }

  return { error };
}

// Convenience read helpers.
export async function getTransferById(id: string): Promise<{ transfer: TransferWithItems | null; error: any }> {
  return transferRepository.getById(id);
}

export async function getBranchTransfers(
  branchId: string,
  options?: { role?: 'source' | 'destination' | 'either'; status?: TransferStatus; direction?: TransferDirection; limit?: number }
): Promise<{ transfers: TransferWithItems[]; error: any }> {
  return transferRepository.getByBranch(branchId, options);
}

export async function getAllTransfers(options?: {
  status?: TransferStatus;
  sourceBranchId?: string;
  destinationBranchId?: string;
  limit?: number;
}): Promise<{ transfers: TransferWithItems[]; error: any }> {
  return transferRepository.getAll(options);
}

export function subscribeToBranchTransfers(branchId: string, callback: () => void): () => void {
  return transferRepository.subscribeOnly(branchId, callback);
}

// Find a destination inventory item with the same (case-insensitive) name as a source line —
// used by the receive flow to pre-fill destination_item_id.
export async function matchDestinationItem(
  destinationBranchId: string,
  sourceItemName: string
): Promise<InventoryItem | null> {
  const { data } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('branch_id', destinationBranchId)
    .ilike('name', sourceItemName)
    .limit(1)
    .maybeSingle();
  return (data as InventoryItem) ?? null;
}

// Resolve (or create) categories at the destination branch by name.
// Returns the dest category UUIDs, in input order, deduplicated.
async function resolveCategoriesAtBranch(
  destinationBranchId: string,
  names: string[]
): Promise<{ ids: string[]; error: any }> {
  const cleaned = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (cleaned.length === 0) return { ids: [], error: null };

  const { data: existing, error: lookupErr } = await supabase
    .from('categories')
    .select('id, name')
    .eq('branch_id', destinationBranchId)
    .in('name', cleaned);
  if (lookupErr) return { ids: [], error: lookupErr };

  const byNameLower = new Map<string, string>();
  for (const row of existing ?? []) {
    byNameLower.set((row as any).name.toLowerCase(), (row as any).id);
  }

  const toCreate = cleaned.filter(n => !byNameLower.has(n.toLowerCase()));
  if (toCreate.length > 0) {
    const { data: created, error: insErr } = await supabase
      .from('categories')
      .insert(toCreate.map(name => ({ branch_id: destinationBranchId, name })))
      .select('id, name');
    if (insErr) return { ids: [], error: insErr };
    for (const row of created ?? []) {
      byNameLower.set((row as any).name.toLowerCase(), (row as any).id);
    }
  }

  return {
    ids: cleaned.map(n => byNameLower.get(n.toLowerCase())!).filter(Boolean),
    error: null,
  };
}

// Create a destination inventory_item from a transfer line's snapshot.
// Used when the receiver confirms "add to catalog" for a missing item.
export async function createItemFromSnapshot(
  destinationBranchId: string,
  snapshot: {
    name: string;
    cost: number | null;
    price: number | null;
    category_names: string[];
  }
): Promise<{ id: string | null; error: any }> {
  const { ids: categoryIds, error: catErr } = await resolveCategoriesAtBranch(
    destinationBranchId,
    snapshot.category_names
  );
  if (catErr) return { id: null, error: catErr };

  const { data: item, error: insErr } = await supabase
    .from('inventory_items')
    .insert({
      branch_id: destinationBranchId,
      name: snapshot.name,
      price: snapshot.price ?? 0,
      cost: snapshot.cost ?? null,
      stock: 0,
      category_id: categoryIds[0] ?? null,
      status: 'active',
      synced_from_main_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insErr || !item) return { id: null, error: insErr };

  if (categoryIds.length > 0) {
    const { error: linkErr } = await supabase.from('inventory_item_categories').insert(
      categoryIds.map(cid => ({ inventory_item_id: item.id, category_id: cid }))
    );
    if (linkErr) {
      // Best effort; the item itself exists, surface the error to caller.
      return { id: item.id, error: linkErr };
    }
  }

  await inventoryRepository.triggerRefresh(destinationBranchId);
  return { id: item.id, error: null };
}
