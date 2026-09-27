import { cashOnHandRepository } from '@/lib/repositories/cashOnHandRepository';
import { logActivity } from '@/services/activityLogService';
import { log } from '@/lib/logging';
import type { CashOnHand, CashOnHandEdit } from '@/types/domain/cashOnHand';

export async function getCashOnHandRange(
  branchId: string,
  startDate: string,
  endDate: string,
): Promise<{ entries: CashOnHand[]; error: any }> {
  return cashOnHandRepository.getByBranchRange(branchId, startDate, endDate);
}

export async function getCashOnHandForDate(
  branchId: string,
  businessDate: string,
): Promise<{ entry: CashOnHand | null; error: any }> {
  return cashOnHandRepository.getForDate(branchId, businessDate);
}

// Create or update the cash on hand for a given business date, logging the change.
export async function setCashOnHand(
  branchId: string,
  businessDate: string,
  amount: number,
  userId: string | null,
): Promise<{ entry: CashOnHand | null; error: any }> {
  log.info('Setting cash on hand', { branchId, businessDate, amount, userId });

  const { entry: existing, error: fetchError } =
    await cashOnHandRepository.getForDate(branchId, businessDate);

  if (fetchError) {
    log.error('Failed to read cash on hand', new Error(fetchError?.message || 'Unknown'), {
      branchId,
      businessDate,
    });
    return { entry: null, error: fetchError };
  }

  if (!existing) {
    const { entry, error } = await cashOnHandRepository.create({
      branch_id: branchId,
      business_date: businessDate,
      amount,
      created_by: userId,
    });

    if (error || !entry) {
      log.error('Failed to create cash on hand', new Error(error?.message || 'Unknown'), {
        branchId,
        businessDate,
      });
      return { entry: null, error };
    }

    void logActivity({
      branchId,
      userId,
      action: 'cash_on_hand_set',
      entityType: 'cash_on_hand',
      entityId: entry.id,
      details: { business_date: businessDate, amount },
    });

    return { entry, error: null };
  }

  const { entry, error } = await cashOnHandRepository.updateAmount(existing.id, amount, userId);

  if (error || !entry) {
    log.error('Failed to update cash on hand', new Error(error?.message || 'Unknown'), {
      branchId,
      businessDate,
    });
    return { entry: null, error };
  }

  void logActivity({
    branchId,
    userId,
    action: 'cash_on_hand_updated',
    entityType: 'cash_on_hand',
    entityId: entry.id,
    details: { business_date: businessDate, old_amount: existing.amount, new_amount: amount },
  });

  return { entry, error: null };
}

export async function getCashOnHandEdits(
  cashOnHandId: string,
): Promise<{ edits: CashOnHandEdit[]; error: any }> {
  return cashOnHandRepository.getEdits(cashOnHandId);
}

export function subscribeToCashOnHand(
  branchId: string,
  startDate: string,
  endDate: string,
  callback: (entries: CashOnHand[]) => void,
): () => void {
  return cashOnHandRepository.subscribe(branchId, startDate, endDate, callback);
}
