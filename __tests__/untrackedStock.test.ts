import { describe, it, expect } from 'vitest';
import { tracksStock, withUntrackedStock, getAvailableStock, UNTRACKED_STOCK } from '@/services/inventoryService';
import type { InventoryItem } from '@/types/domain';

describe('tracksStock', () => {
  it('event branches do not track stock', () => {
    expect(tracksStock({ type: 'event' })).toBe(false);
  });
  it('regular branches and the commissary track stock', () => {
    expect(tracksStock({ type: 'branch' })).toBe(true);
    expect(tracksStock({ type: 'commissary' })).toBe(true);
    expect(tracksStock(null)).toBe(true);
  });
});

describe('withUntrackedStock', () => {
  it('makes zero-stock items sellable', () => {
    const item = { id: 'i1', stock: 0, reserved_stock: 2, uncarried_stock: 3 } as InventoryItem;
    const [untracked] = withUntrackedStock([item]);
    expect(getAvailableStock(untracked)).toBe(UNTRACKED_STOCK);
    expect(item.stock).toBe(0); // source row untouched
  });
});
