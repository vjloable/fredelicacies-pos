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
  id: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  discountAmount: number;
  totalProfit: number;
  discountCode: string;
  createdAt: Timestamp;
  orderType: 'DINE-IN' | 'TAKE OUT' | 'DELIVERY';
  timestamp: Timestamp;
  itemCount: number;
  uniqueItemCount: number;
  workerName: string;
  workerUid: string;
}

export const createOrder = async (
  items: any[], 
  total: number, 
  subtotal: number, 
  workerName: string,
  workerUid: string,
  orderType: 'DINE-IN' | 'TAKE OUT' | 'DELIVERY' = 'TAKE OUT',
  discountAmount: number = 0,
  discountCode: string = ''
): Promise<string> => {
  try {
    const now = new Date();
    const timestamp = Timestamp.fromDate(now);
    
    // Convert items to OrderItem format
    const orderItems: OrderItem[] = items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      cost: item.cost || 0,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
      profit: (item.price - (item.cost || 0)) * item.quantity,
      imgUrl: item.imgUrl || '',
      categoryId: item.categoryId || ''
    }));

    // Generate order ID
    const orderRef = doc(collection(db, 'orders'));
    
    const order: Order = {
      id: orderRef.id,
      items: orderItems,
      discountAmount,
      total,
      subtotal,
      createdAt: timestamp,
      totalProfit: orderItems.reduce((sum, item) => sum + item.profit, 0),
      orderType,
      timestamp: timestamp,
      workerName,
      workerUid,
      discountCode,
      itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItemCount: orderItems.length
    };

    // Save order to Firestore
    await setDoc(orderRef, order);

    // Update inventory stock
    const stockUpdates = items.map(item => ({
      id: item.id,
      stock: -item.quantity // Negative to reduce stock
    }));
    
    await bulkUpdateStock(stockUpdates);

    return orderRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

// Get all orders
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Order));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

// Get orders by date range
export const getOrdersByDateRange = async (startDate: Date, endDate: Date): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      ordersRef,
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Order));
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    return [];
  }
};

// Calculate sales statistics
export const calculateSalesStats = (orders: Order[]) => {
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalProfit = orders.reduce((sum, order) => 
    sum + order.items.reduce((itemSum, item) => itemSum + item.profit, 0), 0
  );
  const totalItemsSold = orders.reduce((sum, order) => 
    sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue,
    totalProfit,
    totalItemsSold,
    totalOrders,
    averageOrderValue
  };
};

// Get top selling items
export const getTopSellingItems = (orders: Order[], limit: number = 10) => {
  const itemStats = new Map<string, {
    name: string;
    quantity: number;
    revenue: number;
    profit: number;
  }>();

  orders.forEach(order => {
    order.items.forEach(item => {
      const existing = itemStats.get(item.id) || {
        name: item.name,
        quantity: 0,
        revenue: 0,
        profit: 0
      };
      
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      existing.profit += item.profit;
      
      itemStats.set(item.id, existing);
    });
  });

  return Array.from(itemStats.entries())
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
};
