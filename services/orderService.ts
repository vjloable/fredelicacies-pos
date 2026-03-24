import { orderRepository, inventoryRepository } from '@/lib/repositories';
import type { OrderWithItems, BundleComponent } from '@/types/domain';
import { logActivity } from '@/services/activityLogService';
import { log, measureTime } from '@/lib/logging';
import { supabase } from '@/lib/supabase';

// Generate order number via server-side atomic counter (format: XXX-YYYY-000001)
// Falls back to timestamp format if the branch has no branch_code set yet.
async function generateOrderNumber(branchId: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_order_number', { p_branch_id: branchId });
  if (error || !data) {
    // Fallback for branches without a branch_code (pre-migration or unset)
    return `ORD-${Date.now()}`;
  }
  return data as string;
}

// Create order with items
export const createOrder = async (
  branchId: string,
  userId: string,
  items: Array<{
    id: string;
    bundleId?: string;
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
  discountAmount?: number,
  paymentMethod?: 'cash' | 'gcash' | 'grab',
  note?: string,
  transactionNumber?: string
): Promise<{ id: string | null; orderNumber?: string; error: any }> => {
  const timer = measureTime();
  log.info('Order creation started', { branchId, userId, itemCount: items.length, total, paymentMethod });

  let orderNumber: string;
  try {
    orderNumber = await generateOrderNumber(branchId);
  } catch (e: any) {
    log.error('Failed to generate order number', e as Error, { branchId, userId });
    return { id: null, error: e };
  }

  // Separate regular items and bundles
  const regularItems = items.filter(i => !i.type || i.type === 'item');
  const bundleItems = items.filter(i => i.type === 'bundle');

  // Prepare order items
  const orderItems = items.map(item => ({
    item_id: (!item.type || item.type === 'item') ? item.id : null,
    bundle_id: item.type === 'bundle' ? (item.bundleId ?? item.id) : null,
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
    userId,
    {
      order_number: orderNumber,
      subtotal,
      total,
      discount_id: discountId || null,
      discount_amount: discountAmount || 0,
      payment_method: paymentMethod ?? 'cash',
      note: note || null,
      transaction_number: transactionNumber || null,
      items: orderItems,
    }
  );

  if (error || !order) {
    log.error('Order creation failed', new Error(error?.message || 'Unknown error'), {
      branchId,
      userId,
      orderNumber,
      error: error?.message
    });
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

  void logActivity({
    branchId,
    userId,
    action: 'order_created',
    entityType: 'order',
    entityId: order.id,
    details: { total, item_count: items.reduce((s, i) => s + i.quantity, 0) },
  });

  const duration = timer.duration();
  log.info('Order created successfully', {
    branchId,
    userId,
    orderId: order.id,
    orderNumber,
    total,
    itemCount: items.length,
    duration,
  });

  return { id: order.id, orderNumber, error: null };
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

// Get orders by user
export const getOrdersByUser = async (
  userId: string,
  limit?: number
): Promise<{ orders: OrderWithItems[]; error: any }> => {
  return await orderRepository.getByUser(userId, { limit });
};

// Get a single paginated page of orders for table display
export const getOrdersPage = async (
  branchId: string,
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: 'cash' | 'gcash' | 'grab';
    status?: 'active' | 'voided';
  }
): Promise<{ orders: OrderWithItems[]; totalCount: number; error: any }> => {
  return orderRepository.getByBranchPaginated(branchId, { page, pageSize, ...options });
};

// Lightweight realtime subscription — notifies on new inserts without fetching all orders
export const subscribeToOrderInserts = (
  branchId: string,
  callback: () => void
): (() => void) => {
  return orderRepository.subscribeOnly(branchId, callback);
};

// Subscribe to orders
export const subscribeToOrders = (
  branchId: string,
  callback: (orders: OrderWithItems[]) => void
): (() => void) => {
  return orderRepository.subscribe(branchId, callback);
};

// Void an order (manager/owner only — enforced in UI; logged for audit)
export const voidOrder = async (
  orderId: string,
  userId: string,
  branchId: string,
  reason: string,
  orderNumber: string,
): Promise<{ error: any }> => {
  log.info('Order void initiated', { branchId, userId, orderId, orderNumber, reason });

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'voided',
      voided_by: userId,
      void_reason: reason.trim() || null,
    })
    .eq('id', orderId);

  if (error) {
    log.error('Order void failed', new Error(error.message), {
      branchId,
      userId,
      orderId,
      orderNumber,
      reason,
    });
    return { error };
  }

  log.info('Order voided successfully', {
    branchId,
    userId,
    orderId,
    orderNumber,
    reason: reason.trim() || null,
  });

  void logActivity({
    branchId,
    userId,
    action: 'order_voided',
    entityType: 'order',
    entityId: orderId,
    details: { order_number: orderNumber, reason: reason.trim() || null },
  });

  return { error };
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
