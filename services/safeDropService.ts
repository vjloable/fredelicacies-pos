import { safeDropRepository } from '@/lib/repositories/safeDropRepository';
import { logActivity } from '@/services/activityLogService';
import { log } from '@/lib/logging';
import type { SafeDrop } from '@/types/domain/safeDrop';

export async function createSafeDrop(
  shiftId: string,
  branchId: string,
  cashierId: string,
  amount: number,
  receiverId: string,
): Promise<{ safeDrop: SafeDrop | null; error: any }> {
  log.info('Creating safe drop', { shiftId, branchId, cashierId, amount, receiverId });

  const { safeDrop, error } = await safeDropRepository.create({
    shift_id: shiftId,
    branch_id: branchId,
    amount,
    cashier_id: cashierId,
    receiver_id: receiverId,
  });

  if (error || !safeDrop) {
    log.error('Failed to create safe drop', new Error(error?.message || 'Unknown'), { shiftId });
    return { safeDrop: null, error };
  }

  void logActivity({
    branchId,
    userId: cashierId,
    action: 'safe_drop',
    entityType: 'safe_drop',
    entityId: safeDrop.id,
    details: { amount, receiver_id: receiverId, shift_id: shiftId },
  });

  return { safeDrop, error: null };
}

export async function getDropsByShift(shiftId: string): Promise<{ drops: SafeDrop[]; error: any }> {
  return safeDropRepository.getByShift(shiftId);
}
