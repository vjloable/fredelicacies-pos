// Domain entity for Order
export interface Order {
  id: string;
  branch_id: string;
  user_id: string;
  order_number: string;
  subtotal: number;
  discount_id: string | null;
  discount_amount: number;
  total: number;
  status: 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  bundle_id: string | null;
  name: string;
  price: number;
  cost: number | null;
  quantity: number;
  is_bundle: boolean;
  bundle_components: any | null;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CreateOrderData {
  user_id: string;
  order_number: string;
  subtotal: number;
  discount_id?: string;
  discount_amount?: number;
  total: number;
  items: Array<{
    item_id?: string;
    bundle_id?: string;
    name: string;
    price: number;
    cost?: number;
    quantity: number;
    is_bundle?: boolean;
    bundle_components?: any;
  }>;
}

export interface UpdateOrderData {
  status?: 'completed' | 'cancelled' | 'refunded';
  discount_id?: string | null;
  discount_amount?: number;
  total?: number;
}
