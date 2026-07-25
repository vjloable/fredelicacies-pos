import { foodHouseRepository } from '@/lib/repositories';
import type { FoodHouseConfig } from '@/types/domain';

export type { FoodHouseConfig };

export const getFoodHouseConfig = async (
  branchId: string
): Promise<{ config: FoodHouseConfig; error: any }> => {
  return await foodHouseRepository.get(branchId);
};

export const saveFoodHouseConfig = async (
  branchId: string,
  dishItemIds: string[],
  containerItemIds: string[]
): Promise<{ config: FoodHouseConfig | null; error: any }> => {
  return await foodHouseRepository.upsert(branchId, dishItemIds, containerItemIds);
};

export const subscribeToFoodHouseConfig = (
  branchId: string,
  callback: (config: FoodHouseConfig) => void
): (() => void) => {
  return foodHouseRepository.subscribe(branchId, callback);
};
