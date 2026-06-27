import { describe, it, expect } from 'vitest';
import {
  calculateEligibleSubtotal,
  isDiscountEligible,
  calculateScPwdDiscount,
  calculateDiscountAmount,
} from '@/services/discountService';
import type { CartItemForDiscount } from '@/services/discountService';
import type { Discount } from '@/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeDiscount(overrides: Partial<Discount> = {}): Discount {
  return {
    id: 'disc-1',
    branch_id: 'branch-1',
    name: 'Test Discount',
    type: 'percentage',
    value: 10,
    status: 'active',
    category_filter_mode: null,
    category_filter_ids: null,
    metadata: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const item = (price: number, quantity: number, categoryIds: string[] = []): CartItemForDiscount => ({
  price,
  quantity,
  categoryIds,
});

// ---------------------------------------------------------------------------
// calculateEligibleSubtotal
// ---------------------------------------------------------------------------
describe('calculateEligibleSubtotal', () => {
  it('returns full subtotal when no category filter is set', () => {
    const d = makeDiscount();
    const cart = [item(100, 2), item(50, 1)];
    expect(calculateEligibleSubtotal(d, cart)).toBe(250);
  });

  it('filters by include mode', () => {
    const d = makeDiscount({
      category_filter_mode: 'include',
      category_filter_ids: ['cat-a'],
    });
    const cart = [item(100, 1, ['cat-a']), item(50, 1, ['cat-b'])];
    expect(calculateEligibleSubtotal(d, cart)).toBe(100);
  });

  it('filters by exclude mode', () => {
    const d = makeDiscount({
      category_filter_mode: 'exclude',
      category_filter_ids: ['cat-a'],
    });
    const cart = [item(100, 1, ['cat-a']), item(50, 1, ['cat-b'])];
    expect(calculateEligibleSubtotal(d, cart)).toBe(50);
  });

  it('returns full subtotal when filter ids array is empty', () => {
    const d = makeDiscount({
      category_filter_mode: 'include',
      category_filter_ids: [],
    });
    const cart = [item(100, 1), item(50, 1)];
    expect(calculateEligibleSubtotal(d, cart)).toBe(150);
  });

  it('handles items with multiple categories (include matches any)', () => {
    const d = makeDiscount({
      category_filter_mode: 'include',
      category_filter_ids: ['cat-a'],
    });
    const cart = [item(200, 1, ['cat-b', 'cat-a'])];
    expect(calculateEligibleSubtotal(d, cart)).toBe(200);
  });

  it('returns 0 for empty cart', () => {
    expect(calculateEligibleSubtotal(makeDiscount(), [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isDiscountEligible
// ---------------------------------------------------------------------------
describe('isDiscountEligible', () => {
  it('b1t1 is eligible when cart has items', () => {
    const d = makeDiscount({ type: 'b1t1' });
    expect(isDiscountEligible(d, [item(100, 1)])).toBe(true);
  });

  it('b1t1 is not eligible when cart is empty', () => {
    const d = makeDiscount({ type: 'b1t1' });
    expect(isDiscountEligible(d, [])).toBe(false);
  });

  it('sc_pwd is eligible when cart has items', () => {
    const d = makeDiscount({ type: 'sc_pwd' });
    expect(isDiscountEligible(d, [item(100, 1)])).toBe(true);
  });

  it('percentage discount is eligible when eligible subtotal > 0', () => {
    const d = makeDiscount({ type: 'percentage' });
    expect(isDiscountEligible(d, [item(100, 1)])).toBe(true);
  });

  it('percentage discount is not eligible when all items filtered out', () => {
    const d = makeDiscount({
      type: 'percentage',
      category_filter_mode: 'include',
      category_filter_ids: ['cat-x'],
    });
    expect(isDiscountEligible(d, [item(100, 1, ['cat-y'])])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateScPwdDiscount
// ---------------------------------------------------------------------------
describe('calculateScPwdDiscount', () => {
  it('calculates with VAT + most expensive only', () => {
    // price=112, discountPct=20, vatRate=12, applyVat=true
    // savings = 112 / 1.12 * (0.12 + 0.20) = 100 * 0.32 = 32
    const result = calculateScPwdDiscount([item(112, 1)], 20, 12, true, true);
    expect(result).toBe(32);
  });

  it('calculates without VAT + most expensive only', () => {
    // savings = 100 * 0.20 = 20
    const result = calculateScPwdDiscount([item(100, 1)], 20, 12, false, true);
    expect(result).toBe(20);
  });

  it('calculates with VAT across all items', () => {
    // item1: 112 / 1.12 * 0.32 = 32; qty 2 => 64
    // item2: 56 / 1.12 * 0.32 = 16; qty 1 => 16
    // total = 80
    const cart = [item(112, 2), item(56, 1)];
    const result = calculateScPwdDiscount(cart, 20, 12, true, false);
    expect(result).toBe(80);
  });

  it('picks the highest priced item for most_expensive_only', () => {
    const cart = [item(50, 1), item(200, 1), item(100, 1)];
    const result = calculateScPwdDiscount(cart, 20, 12, false, true);
    // 200 * 0.20 = 40
    expect(result).toBe(40);
  });

  it('returns 0 for empty cart', () => {
    expect(calculateScPwdDiscount([], 20, 12, true, true)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateDiscountAmount
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount', () => {
  it('returns 0 for b1t1 (handled in cart UI)', () => {
    const d = makeDiscount({ type: 'b1t1', value: 0 });
    expect(calculateDiscountAmount(d, 500)).toBe(0);
  });

  it('calculates percentage discount', () => {
    const d = makeDiscount({ type: 'percentage', value: 15 });
    // 500 * 15 / 100 = 75
    expect(calculateDiscountAmount(d, 500)).toBe(75);
  });

  it('calculates fixed discount', () => {
    const d = makeDiscount({ type: 'fixed', value: 30 });
    expect(calculateDiscountAmount(d, 500)).toBe(30);
  });

  it('fixed discount cannot exceed subtotal', () => {
    const d = makeDiscount({ type: 'fixed', value: 1000 });
    expect(calculateDiscountAmount(d, 200)).toBe(200);
  });

  it('sc_pwd uses defaults when metadata is null', () => {
    const d = makeDiscount({ type: 'sc_pwd', metadata: null });
    const cart = [item(112, 1)];
    // defaults: discountPct=20, vatRate=12, applyVat=true, mostExpensiveOnly=true
    // 112 / 1.12 * 0.32 = 32
    const result = calculateDiscountAmount(d, 112, cart);
    expect(result).toBe(32);
  });

  it('sc_pwd reads custom metadata', () => {
    const d = makeDiscount({
      type: 'sc_pwd',
      metadata: { discount_pct: 10, vat_rate: 12, apply_vat: false, most_expensive_only: false },
    });
    const cart = [item(100, 2)];
    // 100 * 0.10 * 2 = 20
    expect(calculateDiscountAmount(d, 200, cart)).toBe(20);
  });

  it('percentage rounds to 2 decimal places', () => {
    const d = makeDiscount({ type: 'percentage', value: 33 });
    // 100 * 33 / 100 = 33.0
    expect(calculateDiscountAmount(d, 100.01)).toBe(33);
  });
});
