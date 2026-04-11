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
      payment_method?: 'cash' | 'gcash' | 'grab' | 'debit_credit' | 'employee_charge';
      payment_details?: Record<string, string> | null;
      note?: string | null;
      transaction_number?: string | null;
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
        payment_method: orderData.payment_method ?? 'cash',
        note: orderData.note ?? null,
        transaction_number: orderData.transaction_number ?? null,
        payment_details: orderData.payment_details ?? null,
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
      payment_method: order.payment_method ?? 'cash',
      note: order.note ?? null,
      transaction_number: order.transaction_number ?? null,
      payment_details: order.payment_details ?? null,
      status: order.status,
      voided_by: order.voided_by ?? null,
      void_reason: order.void_reason ?? null,
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
      payment_method: data.payment_method ?? 'cash',
      note: data.note ?? null,
      transaction_number: data.transaction_number ?? null,
      payment_details: data.payment_details ?? null,
      status: data.status,
      voided_by: data.voided_by ?? null,
      void_reason: data.void_reason ?? null,
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
      payment_method: order.payment_method ?? 'cash',
      note: order.note ?? null,
      transaction_number: order.transaction_number ?? null,
      payment_details: order.payment_details ?? null,
      status: order.status,
      voided_by: order.voided_by ?? null,
      void_reason: order.void_reason ?? null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.order_items || [],
    }));

    return { orders, error: null };
  },

  // Get paginated orders for table display with total count
  async getByBranchPaginated(
    branchId: string,
    options: {
      page: number;
      pageSize: number;
      search?: string;
      startDate?: string;
      endDate?: string;
      paymentMethod?: 'cash' | 'gcash' | 'grab' | 'debit_credit';
      status?: 'active' | 'voided';
    }
  ): Promise<{ orders: OrderWithItems[]; totalCount: number; error: any }> {
    const { page, pageSize, search, startDate, endDate, paymentMethod, status } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('orders')
      .select('*, order_items (*)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`id.ilike.%${search}%,order_number.ilike.%${search}%`);
    }

    // startDate/endDate are expected to be full ISO timestamps (UTC).
    // Callers should produce them via Date.toISOString() on proper local-time
    // boundaries so the day filter matches the user's wall clock, not UTC.
    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    if (status === 'active') {
      query = query.neq('status', 'voided');
    } else if (status === 'voided') {
      query = query.eq('status', 'voided');
    }

    const { data, error, count } = await query.range(from, to);

    if (error || !data) {
      return { orders: [], totalCount: 0, error };
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
      payment_method: order.payment_method ?? 'cash',
      note: order.note ?? null,
      transaction_number: order.transaction_number ?? null,
      payment_details: order.payment_details ?? null,
      status: order.status,
      voided_by: order.voided_by ?? null,
      void_reason: order.void_reason ?? null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.order_items || [],
    }));

    return { orders, totalCount: count ?? 0, error: null };
  },

  // Lightweight subscription — fires callback on new inserts without fetching all orders
  subscribeOnly(branchId: string, callback: () => void) {
    const channel = supabase
      .channel(`orders-notify-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
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
