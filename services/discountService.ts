import { discountRepository } from '@/lib/repositories';
import type { Discount, CreateDiscountData, UpdateDiscountData } from '@/types/domain';

// Re-export types for convenience
export type { Discount, CreateDiscountData, UpdateDiscountData };

// Create a new discount
export const createDiscount = async (
  branchId: string,
  discountData: CreateDiscountData
): Promise<{ id: string | null; error: any }> => {
  const { discount, error } = await discountRepository.create(branchId, discountData);
  return { id: discount?.id || null, error };
};

// Get all discounts for a branch
export const getDiscounts = async (branchId: string): Promise<{ discounts: Discount[]; error: any }> => {
  return await discountRepository.getByBranch(branchId);
};

// Get active discounts only
export const getActiveDiscounts = async (branchId: string): Promise<{ discounts: Discount[]; error: any }> => {
  return await discountRepository.getActiveByBranch(branchId);
};

// Get discount by ID
export const getDiscountById = async (id: string): Promise<{ discount: Discount | null; error: any }> => {
  return await discountRepository.getById(id);
};

// Update a discount
export const updateDiscount = async (
  id: string,
  updates: UpdateDiscountData
): Promise<{ discount: Discount | null; error: any }> => {
  return await discountRepository.update(id, updates);
};

// Delete a discount
export const deleteDiscount = async (id: string): Promise<{ error: any }> => {
  return await discountRepository.delete(id);
};

// Subscribe to discounts
export const subscribeToDiscounts = (
  branchId: string,
  callback: (discounts: Discount[]) => void
): (() => void) => {
  return discountRepository.subscribe(branchId, callback);
};

// Calculate discount amount
export const calculateDiscountAmount = (
  discount: Discount,
  subtotal: number
): number => {
  if (discount.type === 'percentage') {
    return Math.round((subtotal * discount.value / 100) * 100) / 100; // Round to 2 decimal places
  } else {
    // Fixed discount
    return Math.min(discount.value, subtotal); // Discount can't exceed subtotal
  }
};

// Helper function to check if discounts are empty
export const isDiscountsEmpty = async (branchId: string): Promise<boolean> => {
  const { discounts, error } = await getDiscounts(branchId);
  if (error) return true; // Assume empty on error
  return discounts.length === 0;
};

// Search discounts by name
export const searchDiscounts = async (
  branchId: string,
  searchTerm: string
): Promise<{ discounts: Discount[]; error: any }> => {
  const { discounts, error } = await getDiscounts(branchId);
  
  if (error || !discounts) {
    return { discounts: [], error };
  }
  
  const filteredDiscounts = discounts.filter(discount =>
    discount.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return { discounts: filteredDiscounts, error: null };
};
