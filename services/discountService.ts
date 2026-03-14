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

export type CartItemForDiscount = { price: number; quantity: number; categoryIds: string[] };

// Calculate the subtotal of cart items that qualify under the discount's category filter
export const calculateEligibleSubtotal = (
  discount: Discount,
  cartItems: CartItemForDiscount[]
): number => {
  const { category_filter_mode: mode, category_filter_ids: ids } = discount;
  let eligible = cartItems;
  if (mode && ids && ids.length > 0) {
    eligible = cartItems.filter(item => {
      const matches = item.categoryIds.some(catId => ids.includes(catId));
      return mode === 'include' ? matches : !matches;
    });
  }
  return eligible.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

// Check if a discount is eligible based on cart items (at least one item qualifies)
export const isDiscountEligible = (
  discount: Discount,
  cartItems: CartItemForDiscount[]
): boolean => {
  return calculateEligibleSubtotal(discount, cartItems) > 0;
};

// Calculate discount amount
export const calculateDiscountAmount = (
  discount: Discount,
  subtotal: number
): number => {
  if (discount.type === 'percentage') {
    return Math.round((subtotal * discount.value / 100) * 100) / 100;
  } else {
    return Math.min(discount.value, subtotal);
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
