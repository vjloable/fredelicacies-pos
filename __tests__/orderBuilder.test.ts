import { describe, it, expect } from 'vitest';
import {
  buildOrderLineItems,
  buildReceiptItems,
  buildSplitPaymentDetails,
  buildPaymentDetails,
} from '@/app/(main)/[branchId]/(worker)/store/orderBuilder';
import type { CartLine } from '@/app/(main)/[branchId]/(worker)/store/checkoutTypes';

const base = (over: Partial<CartLine> = {}): CartLine => ({
  id: 'i1',
  name: 'Item',
  price: 10,
  quantity: 2,
  originalStock: 100,
  categoryId: 'c1',
  type: 'item',
  ...over,
});

// ---------------------------------------------------------------------------
// buildOrderLineItems
// ---------------------------------------------------------------------------
describe('buildOrderLineItems', () => {
  it('per-piece line: price = unit, line_total null, not whole', () => {
    const [line] = buildOrderLineItems([base({ price: 15, quantity: 3 })], 'cash');
    expect(line.price).toBe(15);
    expect(line.quantity).toBe(3);
    expect(line.line_total).toBeNull();
    expect(line.is_whole_priced).toBe(false);
  });

  it('whole-priced line carries the absolute line_total', () => {
    const [line] = buildOrderLineItems(
      [base({ priceMode: 'whole', wholePrice: 99, quantity: 4 })],
      'cash'
    );
    expect(line.is_whole_priced).toBe(true);
    expect(line.line_total).toBe(99);
  });

  it('Grab uses grab_price for the unit price', () => {
    const [line] = buildOrderLineItems([base({ price: 10, grab_price: 13 })], 'grab');
    expect(line.price).toBe(13);
  });

  it('defaults cost/imgUrl/categoryId when missing', () => {
    const [line] = buildOrderLineItems([base({ cost: undefined, imgUrl: undefined, categoryId: '' })], 'cash');
    expect(line.cost).toBe(0);
    expect(line.imgUrl).toBe('');
    expect(line.categoryId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildReceiptItems
// ---------------------------------------------------------------------------
describe('buildReceiptItems', () => {
  it('tags B1T1 lines in the printed name', () => {
    const [line] = buildReceiptItems([base({ name: 'Suman', isB1T1: true })], 'cash');
    expect(line.name).toBe('Suman [B1T1]');
  });

  it('per-piece total is unit × qty', () => {
    const [line] = buildReceiptItems([base({ price: 12, quantity: 3 })], 'cash');
    expect(line.total).toBe(36);
  });

  it('whole-priced total is the absolute amount, not unit × qty', () => {
    const [line] = buildReceiptItems(
      [base({ priceMode: 'whole', wholePrice: 50, price: 5, quantity: 20 })],
      'cash'
    );
    expect(line.total).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// buildSplitPaymentDetails
// ---------------------------------------------------------------------------
describe('buildSplitPaymentDetails', () => {
  const input = {
    splitMethod1: 'cash' as const,
    splitAmount1Num: 100,
    splitMethod2: 'gcash' as const,
    splitAmount2Num: 50.5,
    splitTxn1: '',
    splitTxn2: '',
  };

  it('rounds amounts to 2dp and omits blank txn refs', () => {
    const d = buildSplitPaymentDetails(input);
    expect(d.split_amount_1).toBe('100.00');
    expect(d.split_amount_2).toBe('50.50');
    expect(d.split_method_1).toBe('cash');
    expect(d.split_method_2).toBe('gcash');
    expect('split_txn_1' in d).toBe(false);
    expect('split_txn_2' in d).toBe(false);
  });

  it('includes trimmed txn refs when present', () => {
    const d = buildSplitPaymentDetails({ ...input, splitTxn1: ' abc ', splitTxn2: 'xyz' });
    expect(d.split_txn_1).toBe('abc');
    expect(d.split_txn_2).toBe('xyz');
  });
});

// ---------------------------------------------------------------------------
// buildPaymentDetails
// ---------------------------------------------------------------------------
describe('buildPaymentDetails', () => {
  const input = {
    debitReferenceNo: 'REF',
    debitTransactionNo: 'TXN',
    debitApprovalCode: 'APP',
    employeeChargeName: 'Jane',
    split: {
      splitMethod1: 'cash' as const,
      splitAmount1Num: 10,
      splitMethod2: 'gcash' as const,
      splitAmount2Num: 20,
      splitTxn1: '',
      splitTxn2: '',
    },
  };

  it('debit_credit → reference/transaction/approval', () => {
    expect(buildPaymentDetails('debit_credit', input)).toEqual({
      reference_no: 'REF',
      transaction_no: 'TXN',
      approval_code: 'APP',
    });
  });

  it('employee_charge → employee_name', () => {
    expect(buildPaymentDetails('employee_charge', input)).toEqual({ employee_name: 'Jane' });
  });

  it('split → delegates to buildSplitPaymentDetails', () => {
    expect(buildPaymentDetails('split', input)).toEqual({
      split_method_1: 'cash',
      split_amount_1: '10.00',
      split_method_2: 'gcash',
      split_amount_2: '20.00',
    });
  });

  it('cash/gcash/grab → null', () => {
    expect(buildPaymentDetails('cash', input)).toBeNull();
    expect(buildPaymentDetails('gcash', input)).toBeNull();
    expect(buildPaymentDetails('grab', input)).toBeNull();
  });
});
