import { collection, doc, setDoc, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase-config';
import { bulkUpdateStock } from './inventoryService';

export interface OrderItem {
  id: string;
  name: string;
  price: number; // Price at time of sale
  cost: number; // Cost at time of sale (for profit calculation)
  quantity: number;
  subtotal: number; // price * quantity
  profit: number; // (price - cost) * quantity
  imgUrl: string; // Image URL or empty string
  categoryId: number | string;
}

export interface Order {
  id: string; // datetime timestamp
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  discountCode: string; // Discount code or empty string
  total: number;
  totalProfit: number; // Sum of all item profits
  orderType: 'DINE-IN' | 'TAKE OUT' | 'DELIVERY';
  timestamp: Timestamp;
  createdAt: string; // ISO string for easy reading
  itemCount: number; // Total quantity of all items
  uniqueItemCount: number; // Number of different items
}

// Create a new order
export const createOrder = async (orderData: {
  items: Array<{
    id: string;
    name: string;
    price: number;
    cost?: number;
    quantity: number;
    imgUrl?: string | null;
    categoryId: number | string;
    originalStock: number; // Current stock before order
  }>;
  subtotal: number;
  discountAmount: number;
  discountCode?: string;
  total: number;
  orderType: 'DINE-IN' | 'TAKE OUT' | 'DELIVERY';
}): Promise<string> => {
  try {
    // Generate timestamp-based ID
    const now = new Date();
    const timestamp = Timestamp.fromDate(now);
    const orderId = now.getTime().toString(); // Unix timestamp as string
    
    // Calculate item profits and totals
    const processedItems: OrderItem[] = orderData.items.map(item => {
      const subtotal = item.price * item.quantity;
      const cost = item.cost || 0; // Default to 0 if no cost
      const profit = (item.price - cost) * item.quantity;
      
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        cost: cost,
        quantity: item.quantity,
        subtotal,
        profit,
        imgUrl: item.imgUrl || '', // Default to empty string
        categoryId: item.categoryId,
      };
    });
    
    // Calculate total profit
    const totalProfit = processedItems.reduce((sum, item) => {
      return sum + item.profit;
    }, 0);
    
    // Create complete order object
    const order: Order = {
      id: orderId,
      items: processedItems,
      subtotal: orderData.subtotal,
      discountAmount: orderData.discountAmount,
      discountCode: orderData.discountCode || '', // Default to empty string
      total: orderData.total,
      totalProfit: totalProfit,
      orderType: orderData.orderType,
      timestamp,
      createdAt: now.toISOString(),
      itemCount: processedItems.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItemCount: processedItems.length,
    };
    
    // Save to Firebase
    const orderRef = doc(db, 'orders', orderId);
    await setDoc(orderRef, order);
    
    // Update inventory stock levels
    const stockUpdates = orderData.items.map(item => ({
      id: item.id,
      stock: item.originalStock - item.quantity // Reduce stock by quantity ordered
    }));
    
    await bulkUpdateStock(stockUpdates);
    
    console.log('Order created successfully and inventory updated:', orderId);
    return orderId;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

// Get all orders (for sales analytics)
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => doc.data() as Order);
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

// Get orders by date range (for sales analytics)
export const getOrdersByDateRange = async (startDate: Date, endDate: Date): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      ordersRef,
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Order);
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    throw error;
  }
};

// Get orders for today (useful for daily sales)
export const getTodayOrders = async (): Promise<Order[]> => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  
  return getOrdersByDateRange(startOfDay, endOfDay);
};

// Calculate sales statistics from orders
export const calculateSalesStats = (orders: Order[]) => {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalProfit = orders.reduce((sum, order) => sum + order.totalProfit, 0);
  const totalItemsSold = orders.reduce((sum, order) => sum + order.itemCount, 0);
  const totalDiscounts = orders.reduce((sum, order) => sum + order.discountAmount, 0);
  
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  // Order type breakdown
  const orderTypeStats = orders.reduce((stats, order) => {
    stats[order.orderType] = (stats[order.orderType] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);
  
  return {
    totalOrders,
    totalRevenue,
    totalProfit,
    totalItemsSold,
    totalDiscounts,
    averageOrderValue,
    profitMargin,
    orderTypeStats,
  };
};
