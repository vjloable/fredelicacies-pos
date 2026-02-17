import { orderRepository, inventoryRepository } from '@/lib/repositories';
import type { OrderWithItems, BundleComponent } from '@/types/domain';

// Generate order number (simple incrementing format)
function generateOrderNumber(): string {
  const now = new Date();
  const timestamp = now.getTime();
  return `ORD-${timestamp}`;
}

// Create order with items
export const createOrder = async (
  branchId: string,
  workerId: string,
  items: Array<{
    id: string;
    name: string;
    price: number;
    cost?: number;
    quantity: number;
    type?: 'item' | 'bundle';
    is_bundle?: boolean;
    bundle_id?: string;
    item_id?: string;
    components?: BundleComponent[];
    bundle_components?: any;
  }>,
  subtotal: number,
  total: number,
  discountId?: string,
  discountAmount?: number
): Promise<{ id: string | null; error: any }> => {
  const orderNumber = generateOrderNumber();

  // Separate regular items and bundles
  const regularItems = items.filter(i => !i.type || i.type === 'item');
  const bundleItems = items.filter(i => i.type === 'bundle');

  // Prepare order items
  const orderItems = items.map(item => ({
    item_id: (!item.type || item.type === 'item') ? item.id : null,
    bundle_id: item.type === 'bundle' ? item.id : null,
    name: item.name,
    price: item.price,
    cost: item.cost || 0,
    quantity: item.quantity,
    is_bundle: item.type === 'bundle',
    bundle_components: item.type === 'bundle' ? item.components : null,
  }));

  // Create order with items
  const { order, error } = await orderRepository.create(
    branchId,
    workerId,
    {
      order_number: orderNumber,
      subtotal,
      total,
      discount_id: discountId || null,
      discount_amount: discountAmount || 0,
      items: orderItems,
    }
  );

  if (error || !order) {
    return { id: null, error };
  }

  // Calculate stock updates
  // 1. Regular items: deduct their quantity
  const regularStockUpdates = regularItems.map(item => ({
    id: item.id,
    stock: -item.quantity
  }));

  // 2. Bundle components: deduct based on component quantities
  const bundleStockMap = new Map<string, number>();
  bundleItems.forEach(bundle => {
    bundle.components?.forEach(component => {
      const currentDeduction = bundleStockMap.get(component.inventory_item_id) || 0;
      bundleStockMap.set(
        component.inventory_item_id,
        currentDeduction - (component.quantity * bundle.quantity)
      );
    });
  });

  const bundleStockUpdates = Array.from(bundleStockMap.entries()).map(
    ([itemId, stockDelta]) => ({ id: itemId, stock: stockDelta })
  );

  // Combine all stock updates
  const allStockUpdates = [...regularStockUpdates, ...bundleStockUpdates];

  if (allStockUpdates.length > 0) {
    await inventoryRepository.bulkUpdateStock(allStockUpdates);
  }

  return { id: order.id, error: null };
};

// Get orders by branch with date filter
export const getOrdersByBranch = async (
  branchId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ orders: OrderWithItems[]; error: any }> => {
  return await orderRepository.getByBranch(branchId, {
    startDate,
    endDate,
  });
};

// Get orders by worker
export const getOrdersByWorker = async (
  workerId: string,
  limit?: number
): Promise<{ orders: OrderWithItems[]; error: any }> => {
  return await orderRepository.getByWorker(workerId, { limit });
};

// Subscribe to orders
export const subscribeToOrders = (
  branchId: string,
  callback: (orders: OrderWithItems[]) => void
): (() => void) => {
  return orderRepository.subscribe(branchId, callback);
};

// Calculate sales statistics
export const calculateSalesStats = (orders: OrderWithItems[]) => {
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalProfit = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + (item.price - (item.cost || 0)) * item.quantity,
        0
      ),
    0
  );
  const totalItemsSold = orders.reduce(
    (sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue,
    totalProfit,
    totalItemsSold,
    totalOrders,
    averageOrderValue,
  };
};

// Get top selling items
export const getTopSellingItems = (orders: OrderWithItems[], limit: number = 10) => {
  const itemStats = new Map<
    string,
    {
      name: string;
      quantity: number;
      revenue: number;
      profit: number;
    }
  >();

  orders.forEach(order => {
    order.items.forEach(item => {
      const itemId = item.item_id || item.bundle_id || item.id;
      const existing = itemStats.get(itemId) || {
        name: item.name,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };

      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      existing.profit += (item.price - (item.cost || 0)) * item.quantity;

      itemStats.set(itemId, existing);
    });
  });

  return Array.from(itemStats.entries())
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
};
