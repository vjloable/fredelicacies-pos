import { describe, it, expect } from 'vitest';
import { calculateSalesStats, getTopSellingItems } from '@/services/orderService';
import type { OrderWithItems } from '@/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeOrder(overrides: Partial<OrderWithItems> & { items: OrderWithItems['items'] }): OrderWithItems {
  return {
    id: 'o-1',
    branch_id: 'b-1',
    user_id: 'u-1',
    order_number: 'ORD-001',
    subtotal: 0,
    discount_id: null,
    discount_amount: 0,
    total: 0,
    status: 'completed',
    payment_method: 'cash',
    note: null,
    transaction_number: null,
    payment_details: null,
    voided_by: null,
    void_reason: null,
    refunded_by: null,
    refund_reason: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function makeItem(
  name: string,
  price: number,
  cost: number,
  quantity: number,
  whole?: { line_total: number },
) {
  return {
    id: `item-${name}`,
    order_id: 'o-1',
    item_id: `item-${name}`,
    bundle_id: null,
    name,
    price,
    cost,
    quantity,
    line_total: whole ? whole.line_total : null,
    is_whole_priced: !!whole,
    is_bundle: false,
    bundle_components: null,
    created_at: '',
  };
}

// ---------------------------------------------------------------------------
// calculateSalesStats
// ---------------------------------------------------------------------------
describe('calculateSalesStats', () => {
  it('calculates revenue, profit, items sold, and averages', () => {
    const orders = [
      makeOrder({
        total: 300,
        items: [
          makeItem('Bread', 100, 40, 2),  // profit: (100-40)*2 = 120
          makeItem('Cake', 100, 30, 1),   // profit: (100-30)*1 = 70
        ],
      }),
      makeOrder({
        id: 'o-2',
        total: 150,
        items: [
          makeItem('Cookie', 50, 20, 3),  // profit: (50-20)*3 = 90
        ],
      }),
    ];

    const stats = calculateSalesStats(orders);
    expect(stats.totalRevenue).toBe(450);
    expect(stats.totalProfit).toBe(280);
    expect(stats.totalItemsSold).toBe(6); // 2 + 1 + 3
    expect(stats.totalOrders).toBe(2);
    expect(stats.averageOrderValue).toBe(225);
  });

  it('handles empty orders', () => {
    const stats = calculateSalesStats([]);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.totalProfit).toBe(0);
    expect(stats.totalItemsSold).toBe(0);
    expect(stats.totalOrders).toBe(0);
    expect(stats.averageOrderValue).toBe(0);
  });

  it('uses the absolute line_total for whole-priced lines (no rounding drift)', () => {
    // ₱100 across 3 pcs: per-piece would drift to 33.33 * 3 = 99.99. The whole price is exact.
    const orders = [
      makeOrder({
        total: 100,
        items: [makeItem('Bilao', 33.33, 30, 3, { line_total: 100 })],
      }),
    ];
    const stats = calculateSalesStats(orders);
    // revenue comes from order.total; profit uses line_total - cost*qty = 100 - 90 = 10
    expect(stats.totalProfit).toBe(10);
    expect(stats.totalItemsSold).toBe(3);
  });

  it('handles items with no cost (null/0)', () => {
    const orders = [
      makeOrder({
        total: 200,
        items: [makeItem('Mystery', 200, 0, 1)],
      }),
    ];
    const stats = calculateSalesStats(orders);
    expect(stats.totalProfit).toBe(200); // price - 0
  });
});

// ---------------------------------------------------------------------------
// getTopSellingItems
// ---------------------------------------------------------------------------
describe('getTopSellingItems', () => {
  it('ranks items by quantity sold', () => {
    const orders = [
      makeOrder({
        total: 500,
        items: [
          makeItem('Bread', 50, 20, 10),
          makeItem('Cake', 100, 40, 2),
        ],
      }),
      makeOrder({
        id: 'o-2',
        total: 300,
        items: [
          makeItem('Bread', 50, 20, 5),
          makeItem('Cookie', 30, 10, 8),
        ],
      }),
    ];

    const top = getTopSellingItems(orders);
    expect(top[0].name).toBe('Bread');
    expect(top[0].quantity).toBe(15); // 10 + 5
    expect(top[0].revenue).toBe(750); // 50 * 15
    expect(top[0].profit).toBe(450);  // (50-20) * 15

    expect(top[1].name).toBe('Cookie');
    expect(top[1].quantity).toBe(8);

    expect(top[2].name).toBe('Cake');
    expect(top[2].quantity).toBe(2);
  });

  it('respects limit parameter', () => {
    const orders = [
      makeOrder({
        total: 100,
        items: [
          makeItem('A', 10, 5, 1),
          makeItem('B', 10, 5, 2),
          makeItem('C', 10, 5, 3),
        ],
      }),
    ];
    expect(getTopSellingItems(orders, 2)).toHaveLength(2);
  });

  it('handles empty orders', () => {
    expect(getTopSellingItems([])).toEqual([]);
  });

  it('reports whole-priced revenue as the absolute line_total', () => {
    const orders = [
      makeOrder({ total: 100, items: [makeItem('Bilao', 33.33, 30, 3, { line_total: 100 })] }),
    ];
    const top = getTopSellingItems(orders);
    expect(top[0].revenue).toBe(100);      // not 33.33 * 3
    expect(top[0].profit).toBe(10);        // 100 - 30*3
    expect(top[0].quantity).toBe(3);
  });

  it('aggregates same item across multiple orders', () => {
    const orders = [
      makeOrder({ total: 100, items: [makeItem('Bread', 50, 20, 3)] }),
      makeOrder({ id: 'o-2', total: 100, items: [makeItem('Bread', 50, 20, 7)] }),
    ];
    const top = getTopSellingItems(orders);
    expect(top).toHaveLength(1);
    expect(top[0].quantity).toBe(10);
    expect(top[0].revenue).toBe(500);
  });
});
