// Order Repository - Handles order data access with items
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types/domain/order';

export const orderRepository = {
  // Create order with items (transaction-like behavior)
  async create(
    branchId: string,
    userId: string,
    orderData: {
      order_number: string;
      total: number;
      subtotal: number;
      discount_id?: string | null;
      discount_amount?: number;
      items: Array<{
        item_id?: string | null;
        bundle_id?: string | null;
        quantity: number;
        price: number;
        cost?: number;
        name: string;
        is_bundle?: boolean;
        bundle_components?: any;
      }>;
    }
  ): Promise<{ order: OrderWithItems | null; error: any }> {
    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        branch_id: branchId,
        user_id: userId,
        order_number: orderData.order_number,
        total: orderData.total,
        subtotal: orderData.subtotal,
        discount_id: orderData.discount_id || null,
        discount_amount: orderData.discount_amount || 0,
        status: 'completed',
      })
      .select()
      .single();

    if (orderError || !order) {
      return { order: null, error: orderError };
    }

    // Create order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .insert(
        orderData.items.map(item => ({
          order_id: order.id,
          item_id: item.item_id || null,
          bundle_id: item.bundle_id || null,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost || null,
          name: item.name,
          is_bundle: item.is_bundle || false,
          bundle_components: item.bundle_components || null,
        }))
      )
      .select();

    if (itemsError) {
      // If items fail, delete the order (manual rollback)
      await supabase.from('orders').delete().eq('id', order.id);
      return { order: null, error: itemsError };
    }

    return {
      order: {
        ...order,
        items: items || [],
      },
      error: null,
    };
  },

  // Get orders by branch with optional date filter
  async getByBranch(
    branchId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{ orders: OrderWithItems[]; error: any }> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return { orders: [], error };
    }

    // Map to OrderWithItems
    const orders: OrderWithItems[] = data.map(order => ({
      id: order.id,
      branch_id: order.branch_id,
      user_id: order.user_id,
      order_number: order.order_number,
      total: order.total,
      subtotal: order.subtotal,
      discount_id: order.discount_id,
      discount_amount: order.discount_amount,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.order_items || [],
    }));

    return { orders, error: null };
  },

  // Get single order by ID
  async getById(id: string): Promise<{ order: OrderWithItems | null; error: any }> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { order: null, error };
    }

    const order: OrderWithItems = {
      id: data.id,
      branch_id: data.branch_id,
      user_id: data.user_id,
      order_number: data.order_number,
      total: data.total,
      subtotal: data.subtotal,
      discount_id: data.discount_id,
      discount_amount: data.discount_amount,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      items: data.order_items || [],
    };

    return { order, error: null };
  },

  // Get orders by user
  async getByUser(userId: string, options?: { limit?: number }): Promise<{ orders: OrderWithItems[]; error: any }> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { orders: [], error };
    }

    const orders: OrderWithItems[] = data.map(order => ({
      id: order.id,
      branch_id: order.branch_id,
      user_id: order.user_id,
      order_number: order.order_number,
      total: order.total,
      subtotal: order.subtotal,
      discount_id: order.discount_id,
      discount_amount: order.discount_amount,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.order_items || [],
    }));

    return { orders, error: null };
  },

  // Subscribe to order changes for a branch
  subscribe(branchId: string, callback: (orders: OrderWithItems[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ orders }) => callback(orders));

    const channel = supabase
      .channel(`orders-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranch(branchId).then(({ orders }) => callback(orders));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
