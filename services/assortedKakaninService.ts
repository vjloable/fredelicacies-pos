import { assortedKakaninRepository } from '@/lib/repositories';
import type { AssortedKakaninConfig } from '@/types/domain';

export type { AssortedKakaninConfig };

// Get the Assorted Kakanin config for a branch (empty config if unset).
export const getAssortedKakaninConfig = async (
  branchId: string
): Promise<{ config: AssortedKakaninConfig; error: any }> => {
  return await assortedKakaninRepository.get(branchId);
};

// Save the container + kakanin allow-lists for a branch.
export const saveAssortedKakaninConfig = async (
  branchId: string,
  containerItemIds: string[],
  kakaninItemIds: string[]
): Promise<{ config: AssortedKakaninConfig | null; error: any }> => {
  return await assortedKakaninRepository.upsert(branchId, containerItemIds, kakaninItemIds);
};

// Subscribe to config changes for a branch.
export const subscribeToAssortedKakaninConfig = (
  branchId: string,
  callback: (config: AssortedKakaninConfig) => void
): (() => void) => {
  return assortedKakaninRepository.subscribe(branchId, callback);
};
