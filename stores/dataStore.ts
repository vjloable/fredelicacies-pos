import { 
  collection, 
  query, 
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { InventoryItem } from '../services/inventoryService';
import { Category } from '../services/categoryService';
import { Order } from '../services/orderService';
import { Discount } from '../services/discountService';

// Event emitter for state changes
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event: string, data: any) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}

// Singleton DataStore class
class DataStore {
  private static instance: DataStore;
  private eventEmitter = new EventEmitter();
  
  // Data state
  private inventoryItems: InventoryItem[] = [];
  private categories: Category[] = [];
  private orders: Order[] = [];
  private discounts: Discount[] = [];
  
  // Listener states
  private inventoryUnsubscribe: Unsubscribe | null = null;
  private categoriesUnsubscribe: Unsubscribe | null = null;
  private ordersUnsubscribe: Unsubscribe | null = null;
  private discountsUnsubscribe: Unsubscribe | null = null;
  private isInventoryListenerActive = false;
  private isCategoriesListenerActive = false;
  private isOrdersListenerActive = false;
  private isDiscountsListenerActive = false;

  private constructor() {
    // Only initialize listeners on client side
    if (typeof window !== 'undefined') {
      this.initializeListeners();
    }
    
    // Keep listeners alive even when page becomes hidden
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        // Don't stop listeners when page becomes hidden
        // This keeps them alive for cost efficiency
      });
    }
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private initializeListeners() {
    // Only initialize if we're on the client side and have a valid db connection
    if (typeof window === 'undefined' || !db) {
      return;
    }
    
    this.startInventoryListener();
    this.startCategoriesListener();
    this.startOrdersListener();
    this.startDiscountsListener();
  }

  // Inventory Management
  private startInventoryListener() {
    if (this.isInventoryListenerActive) return;
    
    try {
      const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
      
      this.inventoryUnsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          
          const items: InventoryItem[] = [];
          
          if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
              try {
                const data = doc.data();
                if (data) {
                  // Create a proper copy to avoid read-only issues
                  const item: InventoryItem = {
                    id: doc.id,
                    name: data.name || '',
                    price: data.price || 0,
                    cost: data.cost || 0,
                    stock: data.stock || 0,
                    categoryId: data.categoryId || '',
                    description: data.description || '',
                    imgUrl: data.imgUrl || null,
                    createdAt: data.createdAt || Timestamp.now(),
                    updatedAt: data.updatedAt || Timestamp.now()
                  };
                  items.push(item);
                }
              } catch (docError) {
                console.error(doc.id, docError);
              }
            });
          }
          
          this.inventoryItems = items;
          this.eventEmitter.emit('inventoryChanged', items);
          
        },
        (error) => {
          // Still emit an empty array so UI can stop loading
          this.inventoryItems = [];
          this.eventEmitter.emit('inventoryChanged', []);
          this.eventEmitter.emit('inventoryError', error);
        }
      );
      
      this.isInventoryListenerActive = true;
    } catch (error) {
      this.inventoryItems = [];
      this.eventEmitter.emit('inventoryChanged', []);
    }
  }

  private startCategoriesListener() {
    if (this.isCategoriesListenerActive) return;
    
    try {
      const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
      
      this.categoriesUnsubscribe = onSnapshot(q,
        (querySnapshot) => {
          console.log('🏷️ Categories snapshot received, empty:', querySnapshot.empty, 'size:', querySnapshot.size);
          
          const categories: Category[] = [];
          
          if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
              try {
                const data = doc.data();
                if (data) {
                  const category: Category = {
                    id: doc.id,
                    name: data.name || '',
                    color: data.color || '#000000',
                    createdAt: data.createdAt || Timestamp.now()
                  };
                  categories.push(category);
                }
              } catch (docError) {
              }
            });
          }
          this.categories = categories;
          this.eventEmitter.emit('categoriesChanged', categories);
        },
        (error) => {
          this.categories = [];
          this.eventEmitter.emit('categoriesChanged', []);
          this.eventEmitter.emit('categoriesError', error);
        }
      );
      
      this.isCategoriesListenerActive = true;
    } catch (error) {
      this.categories = [];
      this.eventEmitter.emit('categoriesChanged', []);
    }
  }

  private startOrdersListener() {
    if (this.isOrdersListenerActive) return;

    try {
      const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
      
      this.ordersUnsubscribe = onSnapshot(q,
        (querySnapshot) => {
          
          const orders: Order[] = [];
          
          if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
              try {
                const data = doc.data();
                if (data) {
                  // Create a proper copy to avoid read-only issues
                  const order: Order = {
                    id: doc.id,
                    items: data.items || [],
                    subtotal: data.subtotal || 0,
                    discountAmount: data.discountAmount || 0,
                    discountCode: data.discountCode || '',
                    total: data.total || 0,
                    totalProfit: data.totalProfit || 0,
                    orderType: data.orderType || 'DINE-IN',
                    timestamp: data.timestamp || Timestamp.now(),
                    createdAt: data.createdAt || Timestamp.now(),
                    itemCount: data.itemCount || 0,
                    uniqueItemCount: data.uniqueItemCount || 0,
                    workerName: data.workerName || '',
                    workerUid: data.workerUid || ''
                  };
                  orders.push(order);
                }
              } catch (docError) {
                console.error(doc.id, docError);
              }
            });
          }
          
          this.orders = orders;
          this.eventEmitter.emit('ordersChanged', orders);
          
          console.log(`📄 Orders updated: ${orders.length} orders`);
        },
        (error) => {
          this.orders = [];
          this.eventEmitter.emit('ordersChanged', []);
          this.eventEmitter.emit('ordersError', error);
        }
      );
      
      this.isOrdersListenerActive = true;
    } catch (error) {
      this.orders = [];
      this.eventEmitter.emit('ordersChanged', []);
    }
  }

  private startDiscountsListener() {
    if (this.isDiscountsListenerActive) return;

    try {
      const q = query(collection(db, 'discounts'), orderBy('created_at', 'desc'));
      
      this.discountsUnsubscribe = onSnapshot(q,
        (querySnapshot) => {
          console.log('🎯 Discounts snapshot received, empty:', querySnapshot.empty, 'size:', querySnapshot.size);
          
          const discounts: Discount[] = [];
          
          if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
              try {
                const data = doc.data();
                if (data) {
                  const discount: Discount = {
                    id: doc.id,
                    discount_code: data.discount_code || doc.id,
                    type: data.type || 'flat',
                    value: data.value || 0,
                    applies_to: data.applies_to || null,
                    created_at: data.created_at || Timestamp.now(),
                    modified_at: data.modified_at || Timestamp.now(),
                    created_by: data.created_by || ''
                  };
                  discounts.push(discount);
                }
              } catch (docError) {
                console.error(doc.id, docError);
              }
            });
          }
          
          this.discounts = discounts;
          this.eventEmitter.emit('discountsChanged', discounts);
          console.log(`🎯 Discounts updated: ${discounts.length} discounts`);
        },
        (error) => {
          this.discounts = [];
          this.eventEmitter.emit('discountsChanged', []);
          this.eventEmitter.emit('discountsError', error);
        }
      );
      
      this.isDiscountsListenerActive = true;
    } catch (error) {
      this.discounts = [];
      this.eventEmitter.emit('discountsChanged', []);
    }
  }

  // Public methods to subscribe to data changes
  public subscribeToInventory(callback: (items: InventoryItem[]) => void): () => void {
    
    // Ensure listeners are started (client-side only)
    if (typeof window !== 'undefined' && !this.isInventoryListenerActive) {
      this.initializeListeners();
    }
    
    // Always call with current data (even if empty array)
    callback(this.inventoryItems);
    
    // Subscribe to future changes
    this.eventEmitter.on('inventoryChanged', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('inventoryChanged', callback);
    };
  }

  public subscribeToCategories(callback: (categories: Category[]) => void): () => void {
    console.log('🔗 New categories subscription created');
    
    // Ensure listeners are started (client-side only)
    if (typeof window !== 'undefined' && !this.isCategoriesListenerActive) {
      this.initializeListeners();
    }
    
    // Always call with current data (even if empty array)
    callback(this.categories);
    
    // Subscribe to future changes
    this.eventEmitter.on('categoriesChanged', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('categoriesChanged', callback);
    };
  }

  public subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    
    // Ensure listeners are started (client-side only)
    if (typeof window !== 'undefined' && !this.isOrdersListenerActive) {
      this.initializeListeners();
    }
    
    // Always call with current data (even if empty array)
    callback(this.orders);
    
    // Subscribe to future changes
    this.eventEmitter.on('ordersChanged', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('ordersChanged', callback);
    };
  }

  public subscribeToDiscounts(callback: (discounts: Discount[]) => void): () => void {
    console.log('🔗 New discounts subscription created');
    
    // Ensure listeners are started (client-side only)
    if (typeof window !== 'undefined' && !this.isDiscountsListenerActive) {
      this.initializeListeners();
    }
    
    // Always call with current data (even if empty array)
    callback(this.discounts);
    
    // Subscribe to future changes
    this.eventEmitter.on('discountsChanged', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('discountsChanged', callback);
    };
  }

  public subscribeToInventoryErrors(callback: (error: any) => void): () => void {
    this.eventEmitter.on('inventoryError', callback);
    return () => {
      this.eventEmitter.off('inventoryError', callback);
    };
  }

  public subscribeToCategoriesErrors(callback: (error: any) => void): () => void {
    this.eventEmitter.on('categoriesError', callback);
    return () => {
      this.eventEmitter.off('categoriesError', callback);
    };
  }

  public subscribeToOrdersErrors(callback: (error: any) => void): () => void {
    this.eventEmitter.on('ordersError', callback);
    return () => {
      this.eventEmitter.off('ordersError', callback);
    };
  }

  public subscribeToDiscountsErrors(callback: (error: any) => void): () => void {
    this.eventEmitter.on('discountsError', callback);
    return () => {
      this.eventEmitter.off('discountsError', callback);
    };
  }

  // Get current data synchronously
  public getInventoryItems(): InventoryItem[] {
    return [...this.inventoryItems];
  }

  public getCategories(): Category[] {
    return [...this.categories];
  }

  public getOrders(): Order[] {
    return [...this.orders];
  }

  public getDiscounts(): Discount[] {
    return [...this.discounts];
  }

  // Cleanup method (optional - usually not needed due to singleton nature)
  public cleanup() {
    
    if (this.inventoryUnsubscribe) {
      this.inventoryUnsubscribe();
      this.inventoryUnsubscribe = null;
      this.isInventoryListenerActive = false;
    }
    
    if (this.categoriesUnsubscribe) {
      this.categoriesUnsubscribe();
      this.categoriesUnsubscribe = null;
      this.isCategoriesListenerActive = false;
    }

    if (this.ordersUnsubscribe) {
      this.ordersUnsubscribe();
      this.ordersUnsubscribe = null;
      this.isOrdersListenerActive = false;
    }

    if (this.discountsUnsubscribe) {
      this.discountsUnsubscribe();
      this.discountsUnsubscribe = null;
      this.isDiscountsListenerActive = false;
    }
  }

  // Method to restart listeners if needed
  public restartListeners() {
    this.cleanup();
    this.initializeListeners();
  }

  // Get listener status
  public getListenerStatus() {
    return {
      inventory: this.isInventoryListenerActive,
      categories: this.isCategoriesListenerActive,
      orders: this.isOrdersListenerActive,
      discounts: this.isDiscountsListenerActive,
      inventoryItemsCount: this.inventoryItems.length,
      categoriesCount: this.categories.length,
      ordersCount: this.orders.length
    };
  }
}

// Export singleton instance
export const dataStore = DataStore.getInstance();

// Export convenience functions that use the singleton
export const subscribeToInventoryItems = (callback: (items: InventoryItem[]) => void) => {
  return dataStore.subscribeToInventory(callback);
};

export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
  return dataStore.subscribeToCategories(callback);
};

export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
  return dataStore.subscribeToOrders(callback);
};

export const subscribeToDiscounts = (callback: (discounts: Discount[]) => void) => {
  return dataStore.subscribeToDiscounts(callback);
};

export const getInventoryItems = () => {
  return dataStore.getInventoryItems();
};

export const getCategories = () => {
  return dataStore.getCategories();
};

export const getOrders = () => {
  return dataStore.getOrders();
};

export const getDiscounts = () => {
  return dataStore.getDiscounts();
};

// Export for debugging
export const getDataStoreStatus = () => {
  return dataStore.getListenerStatus();
};
