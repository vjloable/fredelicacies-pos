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
  if (discount.type === 'b1t1') return cartItems.length > 0;
  if (discount.type === 'sc_pwd') return cartItems.length > 0;
  return calculateEligibleSubtotal(discount, cartItems) > 0;
};

// SC/PWD: configurable VAT exemption + percentage discount.
// With VAT:  savings = price / (1 + vat_rate) * (vat_rate + discount_pct)
// Without:   savings = price * discount_pct
// most_expensive_only: applies formula to just the highest-priced item
// otherwise:            sums across all items
export const calculateScPwdDiscount = (
  cartItems: CartItemForDiscount[],
  discountPct: number,
  vatRate: number,
  applyVat: boolean,
  mostExpensiveOnly: boolean
): number => {
  if (cartItems.length === 0) return 0;
  const dp = discountPct / 100;
  const vr = vatRate / 100;
  const calc = (price: number) =>
    applyVat ? price / (1 + vr) * (vr + dp) : price * dp;

  if (mostExpensiveOnly) {
    const maxPrice = Math.max(...cartItems.map(i => i.price));
    return Math.round(calc(maxPrice) * 100) / 100;
  }
  const total = cartItems.reduce((sum, i) => sum + calc(i.price) * i.quantity, 0);
  return Math.round(total * 100) / 100;
};

// Calculate discount amount
export const calculateDiscountAmount = (
  discount: Discount,
  subtotal: number,
  cartItems?: CartItemForDiscount[]
): number => {
  if (discount.type === 'b1t1') return 0; // B1T1 savings computed interactively in cart
  if (discount.type === 'sc_pwd') {
    const discountPct = discount.metadata?.discount_pct ?? 20;
    const vatRate = discount.metadata?.vat_rate ?? 12;
    const applyVat = discount.metadata?.apply_vat !== false;
    const mostExpensiveOnly = discount.metadata?.most_expensive_only !== false;
    return calculateScPwdDiscount(cartItems ?? [], discountPct, vatRate, applyVat, mostExpensiveOnly);
  }
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
