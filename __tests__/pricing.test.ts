import { describe, it, expect } from 'vitest';
import {
  isCashierPriced,
  effectiveUnitPrice,
  wholePriceOf,
  isWholeLine,
  lineTotal,
  computeSubtotal,
  computeB1T1Savings,
  clampManualDiscount,
  resolveDiscount,
  computeTotal,
  validateSplit,
} from '@/lib/pricing';
import type { CartLineLike, WholeLike, B1T1Line } from '@/lib/pricing';

// ---------------------------------------------------------------------------
// isCashierPriced
// ---------------------------------------------------------------------------
describe('isCashierPriced', () => {
  it('true for plain item (no type, no flags)', () => {
    const item: CartLineLike = { price: 10 };
    expect(isCashierPriced(item)).toBe(true);
  });

  it('true when type is explicitly "item"', () => {
    expect(isCashierPriced({ type: 'item', price: 10 })).toBe(true);
  });

  it('false when type is "bundle"', () => {
    expect(isCashierPriced({ type: 'bundle', price: 10 })).toBe(false);
  });

  it('false when isB1T1 is true', () => {
    expect(isCashierPriced({ price: 10, isB1T1: true })).toBe(false);
  });

  it('false when is_custom is true', () => {
    expect(isCashierPriced({ price: 10, is_custom: true })).toBe(false);
  });

  it('false when multiple disqualifying flags are set', () => {
    expect(
      isCashierPriced({ type: 'bundle', price: 10, isB1T1: true, is_custom: true })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// effectiveUnitPrice
// ---------------------------------------------------------------------------
describe('effectiveUnitPrice', () => {
  it('non-grab returns price', () => {
    expect(effectiveUnitPrice({ price: 50 }, 'cash')).toBe(50);
  });

  it('grab returns grab_price when set', () => {
    expect(effectiveUnitPrice({ price: 50, grab_price: 60 }, 'grab')).toBe(60);
  });

  it('grab falls back to price when grab_price is null', () => {
    expect(effectiveUnitPrice({ price: 50, grab_price: null }, 'grab')).toBe(50);
  });

  it('grab falls back to price when grab_price is undefined', () => {
    expect(effectiveUnitPrice({ price: 50 }, 'grab')).toBe(50);
  });

  it('non-grab ignores grab_price entirely', () => {
    expect(effectiveUnitPrice({ price: 50, grab_price: 999 }, 'cash')).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// wholePriceOf
// ---------------------------------------------------------------------------
describe('wholePriceOf', () => {
  it('non-grab returns wholePrice when set', () => {
    const item: WholeLike = { price: 10, wholePrice: 90 };
    expect(wholePriceOf(item, 'cash')).toBe(90);
  });

  it('non-grab returns null when wholePrice is null', () => {
    const item: WholeLike = { price: 10, wholePrice: null };
    expect(wholePriceOf(item, 'cash')).toBeNull();
  });

  it('non-grab returns null when wholePrice is undefined', () => {
    const item: WholeLike = { price: 10 };
    expect(wholePriceOf(item, 'cash')).toBeNull();
  });

  it('grab returns grabWholePrice when set', () => {
    const item: WholeLike = { price: 10, grabWholePrice: 100 };
    expect(wholePriceOf(item, 'grab')).toBe(100);
  });

  it('grab returns null when grabWholePrice is null', () => {
    const item: WholeLike = { price: 10, grabWholePrice: null };
    expect(wholePriceOf(item, 'grab')).toBeNull();
  });

  it('grab returns null when grabWholePrice is undefined (does not fall back to wholePrice)', () => {
    const item: WholeLike = { price: 10, wholePrice: 90 };
    expect(wholePriceOf(item, 'grab')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isWholeLine
// ---------------------------------------------------------------------------
describe('isWholeLine', () => {
  it('non-grab: true when priceMode is whole and wholePrice is set', () => {
    const item: WholeLike = { price: 10, priceMode: 'whole', wholePrice: 90 };
    expect(isWholeLine(item, 'cash')).toBe(true);
  });

  it('non-grab: false when priceMode is per_piece', () => {
    const item: WholeLike = { price: 10, priceMode: 'per_piece', wholePrice: 90 };
    expect(isWholeLine(item, 'cash')).toBe(false);
  });

  it('non-grab: false when priceMode is whole but wholePrice is null', () => {
    const item: WholeLike = { price: 10, priceMode: 'whole', wholePrice: null };
    expect(isWholeLine(item, 'cash')).toBe(false);
  });

  it('non-grab: false when priceMode is undefined', () => {
    const item: WholeLike = { price: 10, wholePrice: 90 };
    expect(isWholeLine(item, 'cash')).toBe(false);
  });

  it('grab: true when grabPriceMode is whole and grabWholePrice is set', () => {
    const item: WholeLike = { price: 10, grabPriceMode: 'whole', grabWholePrice: 100 };
    expect(isWholeLine(item, 'grab')).toBe(true);
  });

  it('grab: false when grabPriceMode is per_piece', () => {
    const item: WholeLike = { price: 10, grabPriceMode: 'per_piece', grabWholePrice: 100 };
    expect(isWholeLine(item, 'grab')).toBe(false);
  });

  it('grab: false when grabPriceMode is whole but grabWholePrice is null', () => {
    const item: WholeLike = { price: 10, grabPriceMode: 'whole', grabWholePrice: null };
    expect(isWholeLine(item, 'grab')).toBe(false);
  });

  it('grab ignores non-grab priceMode/wholePrice fields', () => {
    const item: WholeLike = { price: 10, priceMode: 'whole', wholePrice: 90 };
    expect(isWholeLine(item, 'grab')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lineTotal
// ---------------------------------------------------------------------------
describe('lineTotal', () => {
  it('non-grab per-piece: unit price × quantity', () => {
    const item = { price: 20, quantity: 3 };
    expect(lineTotal(item, 'cash')).toBe(60);
  });

  it('non-grab whole: exact whole price, NOT × quantity', () => {
    const item: WholeLike & { quantity: number } = {
      price: 20,
      quantity: 3,
      priceMode: 'whole',
      wholePrice: 55,
    };
    expect(lineTotal(item, 'cash')).toBe(55);
  });

  it('grab per-piece: grab unit price × quantity', () => {
    const item = { price: 20, grab_price: 25, quantity: 4 };
    expect(lineTotal(item, 'grab')).toBe(100);
  });

  it('grab per-piece falls back to price when grab_price missing', () => {
    const item = { price: 20, quantity: 4 };
    expect(lineTotal(item, 'grab')).toBe(80);
  });

  it('grab whole: exact grab whole price, NOT × quantity', () => {
    const item: WholeLike & { quantity: number } = {
      price: 20,
      grab_price: 25,
      quantity: 4,
      grabPriceMode: 'whole',
      grabWholePrice: 95,
    };
    expect(lineTotal(item, 'grab')).toBe(95);
  });

  it('quantity of 0 with per-piece pricing yields 0', () => {
    expect(lineTotal({ price: 20, quantity: 0 }, 'cash')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSubtotal
// ---------------------------------------------------------------------------
describe('computeSubtotal', () => {
  it('empty cart returns 0', () => {
    expect(computeSubtotal([], 'cash')).toBe(0);
  });

  it('sums multiple per-piece lines', () => {
    const cart = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 4 },
    ];
    expect(computeSubtotal(cart, 'cash')).toBe(40);
  });

  it('mix of whole and per-piece lines', () => {
    const cart: Array<WholeLike & { quantity: number }> = [
      { price: 10, quantity: 2 }, // 20
      { price: 5, quantity: 3, priceMode: 'whole', wholePrice: 12 }, // 12, not ×3
    ];
    expect(computeSubtotal(cart, 'cash')).toBe(32);
  });

  it('grab vs non-grab totals differ when grab pricing set', () => {
    const cart: Array<WholeLike & { quantity: number }> = [
      { price: 10, grab_price: 15, quantity: 2 },
    ];
    expect(computeSubtotal(cart, 'cash')).toBe(20);
    expect(computeSubtotal(cart, 'grab')).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// computeB1T1Savings
// ---------------------------------------------------------------------------
describe('computeB1T1Savings', () => {
  it('returns 0 for empty cart', () => {
    expect(computeB1T1Savings([])).toBe(0);
  });

  it('ignores non-B1T1 lines', () => {
    const cart: B1T1Line[] = [{ isB1T1: false, regularPrice: 100, price: 50, quantity: 2 }];
    expect(computeB1T1Savings(cart)).toBe(0);
  });

  it('ignores lines with isB1T1 undefined', () => {
    const cart: B1T1Line[] = [{ regularPrice: 100, price: 50, quantity: 2 }];
    expect(computeB1T1Savings(cart)).toBe(0);
  });

  it('computes savings for B1T1 line: (regularPrice - price) × quantity', () => {
    const cart: B1T1Line[] = [{ isB1T1: true, regularPrice: 100, price: 50, quantity: 2 }];
    expect(computeB1T1Savings(cart)).toBe(100);
  });

  it('regularPrice null falls back to price, yielding 0 savings', () => {
    const cart: B1T1Line[] = [{ isB1T1: true, regularPrice: null, price: 50, quantity: 2 }];
    expect(computeB1T1Savings(cart)).toBe(0);
  });

  it('regularPrice undefined falls back to price, yielding 0 savings', () => {
    const cart: B1T1Line[] = [{ isB1T1: true, price: 50, quantity: 2 }];
    expect(computeB1T1Savings(cart)).toBe(0);
  });

  it('sums savings across multiple B1T1 lines and ignores non-B1T1 ones', () => {
    const cart: B1T1Line[] = [
      { isB1T1: true, regularPrice: 100, price: 60, quantity: 1 }, // 40
      { isB1T1: true, regularPrice: 50, price: 30, quantity: 2 }, // 40
      { isB1T1: false, regularPrice: 999, price: 1, quantity: 5 }, // ignored
    ];
    expect(computeB1T1Savings(cart)).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// clampManualDiscount
// ---------------------------------------------------------------------------
describe('clampManualDiscount', () => {
  it('empty string yields 0', () => {
    expect(clampManualDiscount('', 100)).toBe(0);
  });

  it('non-numeric string (NaN) yields 0', () => {
    expect(clampManualDiscount('abc', 100)).toBe(0);
  });

  it('"0" yields 0', () => {
    expect(clampManualDiscount('0', 100)).toBe(0);
  });

  it('negative value yields 0', () => {
    expect(clampManualDiscount('-10', 100)).toBe(0);
  });

  it('positive value below subtotal returns itself', () => {
    expect(clampManualDiscount('30', 100)).toBe(30);
  });

  it('positive value equal to subtotal returns itself', () => {
    expect(clampManualDiscount('100', 100)).toBe(100);
  });

  it('positive value above subtotal is clamped to subtotal', () => {
    expect(clampManualDiscount('150', 100)).toBe(100);
  });

  it('parses leading numeric portion of a partially numeric string', () => {
    expect(clampManualDiscount('25abc', 100)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// resolveDiscount
// ---------------------------------------------------------------------------
describe('resolveDiscount', () => {
  const base = {
    grabManualDiscountAmount: 0,
    manualDiscountAmount: 0,
    appliedDiscountType: null as string | null,
    discountAmount: 0,
    b1t1SavingsAmount: 0,
  };

  it('grab: uses grabManualDiscountAmount for both effective and display', () => {
    const result = resolveDiscount({
      ...base,
      paymentMethod: 'grab',
      grabManualDiscountAmount: 40,
      manualDiscountAmount: 999, // should be ignored on grab path
      discountAmount: 999,
      b1t1SavingsAmount: 999,
    });
    expect(result).toEqual({ effectiveDiscountForTotal: 40, displayDiscount: 40 });
  });

  it('grab: with 0 grab manual discount', () => {
    const result = resolveDiscount({ ...base, paymentMethod: 'grab' });
    expect(result).toEqual({ effectiveDiscountForTotal: 0, displayDiscount: 0 });
  });

  it('non-grab: manualDiscountAmount > 0 wins for both effective and display', () => {
    const result = resolveDiscount({
      ...base,
      paymentMethod: 'cash',
      manualDiscountAmount: 25,
      appliedDiscountType: 'b1t1',
      discountAmount: 999,
      b1t1SavingsAmount: 999,
    });
    expect(result).toEqual({ effectiveDiscountForTotal: 25, displayDiscount: 25 });
  });

  it('non-grab: dropdown non-b1t1 discount uses discountAmount for both', () => {
    const result = resolveDiscount({
      ...base,
      paymentMethod: 'cash',
      appliedDiscountType: 'percentage',
      discountAmount: 50,
    });
    expect(result).toEqual({ effectiveDiscountForTotal: 50, displayDiscount: 50 });
  });

  it('non-grab: no discount type and no manual discount yields all zeros', () => {
    const result = resolveDiscount({ ...base, paymentMethod: 'cash' });
    expect(result).toEqual({ effectiveDiscountForTotal: 0, displayDiscount: 0 });
  });

  it('non-grab: b1t1 dropdown discount subtracts 0 from total but displays savings', () => {
    const result = resolveDiscount({
      ...base,
      paymentMethod: 'cash',
      appliedDiscountType: 'b1t1',
      discountAmount: 999, // irrelevant for b1t1
      b1t1SavingsAmount: 75,
    });
    expect(result).toEqual({ effectiveDiscountForTotal: 0, displayDiscount: 75 });
  });
});

// ---------------------------------------------------------------------------
// computeTotal
// ---------------------------------------------------------------------------
describe('computeTotal', () => {
  it('subtracts effective discount from subtotal', () => {
    expect(computeTotal(200, 50)).toBe(150);
  });

  it('zero discount leaves subtotal unchanged', () => {
    expect(computeTotal(200, 0)).toBe(200);
  });

  it('discount equal to subtotal yields 0', () => {
    expect(computeTotal(200, 200)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateSplit
// ---------------------------------------------------------------------------
describe('validateSplit', () => {
  it('non-split payment is always valid regardless of amounts', () => {
    const result = validateSplit({
      paymentMethod: 'cash',
      total: 100,
      amount1: '0',
      amount2: '0',
      method1: 'cash',
      method2: 'cash',
    });
    expect(result.valid).toBe(true);
  });

  it('split valid when methods differ, both amounts positive, and sum matches exactly', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '60',
      amount2: '40',
      method1: 'cash',
      method2: 'grab',
    });
    expect(result.valid).toBe(true);
    expect(result.amount1Num).toBe(60);
    expect(result.amount2Num).toBe(40);
    expect(result.sum).toBe(100);
    expect(result.diff).toBe(0);
  });

  it('invalid when both methods are the same', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '60',
      amount2: '40',
      method1: 'cash',
      method2: 'cash',
    });
    expect(result.valid).toBe(false);
  });

  it('invalid when amount1 is 0', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '0',
      amount2: '100',
      method1: 'cash',
      method2: 'grab',
    });
    expect(result.valid).toBe(false);
  });

  it('invalid when amount2 is 0', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '100',
      amount2: '0',
      method1: 'cash',
      method2: 'grab',
    });
    expect(result.valid).toBe(false);
  });

  it('invalid when sum mismatches beyond rounding tolerance', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '60',
      amount2: '39',
      method1: 'cash',
      method2: 'grab',
    });
    expect(result.valid).toBe(false);
    expect(result.diff).toBe(1);
  });

  it('valid at the 0.004 boundary (just inside 0.005 tolerance)', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '60',
      amount2: '39.996',
      method1: 'cash',
      method2: 'grab',
    });
    // sum = 99.996, diff = round((100-99.996)*100)/100 = round(0.4)/100 = 0
    expect(result.diff).toBe(0);
    expect(Math.abs(result.diff)).toBeLessThan(0.005);
    expect(result.valid).toBe(true);
  });

  it('invalid when diff sits at/above the 0.005 tolerance (0.01 mismatch)', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '60',
      amount2: '39.99',
      method1: 'cash',
      method2: 'grab',
    });
    // sum = 99.99, diff = 0.01, which is >= 0.005 tolerance -> invalid
    expect(result.diff).toBe(0.01);
    expect(result.valid).toBe(false);
  });

  it('amount strings that fail to parse default to 0', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 0,
      amount1: 'abc',
      amount2: 'xyz',
      method1: 'cash',
      method2: 'grab',
    });
    expect(result.amount1Num).toBe(0);
    expect(result.amount2Num).toBe(0);
    expect(result.sum).toBe(0);
    // both amounts are 0 (not > 0), so invalid even though methods differ and diff is 0
    expect(result.valid).toBe(false);
  });

  it('returns correct diff sign when sum exceeds total', () => {
    const result = validateSplit({
      paymentMethod: 'split',
      total: 100,
      amount1: '70',
      amount2: '40',
      method1: 'cash',
      method2: 'grab',
    });
    expect(result.sum).toBe(110);
    expect(result.diff).toBe(-10);
    expect(result.valid).toBe(false);
  });
});
