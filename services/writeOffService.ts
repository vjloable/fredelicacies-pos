import { writeOffRepository } from '@/lib/repositories/writeOffRepository';
import { inventoryRepository } from '@/lib/repositories';
import { logActivity } from '@/services/activityLogService';
import { log } from '@/lib/logging';
import type { WriteOff, WriteOffType } from '@/types/domain/writeOff';

export async function createWriteOff(
  branchId: string,
  userId: string,
  data: {
    shiftId?: string;
    type: WriteOffType;
    itemId?: string;
    itemName: string;
    quantity: number;
    amount: number;
    reason?: string;
  }
): Promise<{ writeOff: WriteOff | null; error: any }> {
  log.info('Creating write-off', { branchId, userId, ...data });

  const { writeOff, error } = await writeOffRepository.create({
    shift_id: data.shiftId,
    branch_id: branchId,
    type: data.type,
    item_id: data.itemId,
    item_name: data.itemName,
    quantity: data.quantity,
    amount: data.amount,
    reason: data.reason,
    created_by: userId,
  });

  if (error || !writeOff) {
    log.error('Failed to create write-off', new Error(error?.message || 'Unknown'), { branchId });
    return { writeOff: null, error };
  }

  // Deduct stock from inventory
  if (data.itemId) {
    await inventoryRepository.bulkUpdateStock([
      { id: data.itemId, stock: -data.quantity },
    ]);
  }

  void logActivity({
    branchId,
    userId,
    action: 'write_off_created',
    entityType: 'write_off',
    entityId: writeOff.id,
    details: {
      type: data.type,
      item_name: data.itemName,
      quantity: data.quantity,
      amount: data.amount,
    },
  });

  return { writeOff, error: null };
}

export async function getWriteOffsByShift(shiftId: string): Promise<{ writeOffs: WriteOff[]; error: any }> {
  return writeOffRepository.getByShift(shiftId);
}
