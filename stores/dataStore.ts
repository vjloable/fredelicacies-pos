import { 
  collection, 
  query, 
  orderBy,
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { InventoryItem } from '../services/inventoryService';
import { Category } from '../services/categoryService';

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
  
  // Listener states
  private inventoryUnsubscribe: Unsubscribe | null = null;
  private categoriesUnsubscribe: Unsubscribe | null = null;
  private isInventoryListenerActive = false;
  private isCategoriesListenerActive = false;

  private constructor() {
    // Initialize listeners immediately
    this.initializeListeners();
    
    // Keep listeners alive even when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      // Don't stop listeners when page becomes hidden
      // This keeps them alive for cost efficiency
      console.log('Page visibility changed, keeping listeners alive');
    });
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private initializeListeners() {
    this.startInventoryListener();
    this.startCategoriesListener();
  }

  // Inventory Management
  private startInventoryListener() {
    if (this.isInventoryListenerActive) return;

    console.log('🔥 Starting inventory listener (singleton)');
    
    const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
    
    this.inventoryUnsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const items: InventoryItem[] = [];
        querySnapshot.forEach((doc) => {
          items.push({
            id: doc.id,
            ...doc.data()
          } as InventoryItem);
        });
        
        this.inventoryItems = items;
        this.eventEmitter.emit('inventoryChanged', items);
        
        console.log(`📦 Inventory updated: ${items.length} items`);
      },
      (error) => {
        console.error('❌ Inventory listener error:', error);
        this.eventEmitter.emit('inventoryError', error);
      }
    );
    
    this.isInventoryListenerActive = true;
  }

  private startCategoriesListener() {
    if (this.isCategoriesListenerActive) return;

    console.log('🔥 Starting categories listener (singleton)');
    
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    
    this.categoriesUnsubscribe = onSnapshot(q,
      (querySnapshot) => {
        const categories: Category[] = [];
        querySnapshot.forEach((doc) => {
          categories.push({
            id: doc.id,
            ...doc.data()
          } as Category);
        });
        
        this.categories = categories;
        this.eventEmitter.emit('categoriesChanged', categories);
        
        console.log(`🏷️ Categories updated: ${categories.length} categories`);
      },
      (error) => {
        console.error('❌ Categories listener error:', error);
        this.eventEmitter.emit('categoriesError', error);
      }
    );
    
    this.isCategoriesListenerActive = true;
  }

  // Public methods to subscribe to data changes
  public subscribeToInventory(callback: (items: InventoryItem[]) => void): () => void {
    // Immediately call with current data if available
    if (this.inventoryItems.length > 0) {
      callback(this.inventoryItems);
    }
    
    // Subscribe to future changes
    this.eventEmitter.on('inventoryChanged', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('inventoryChanged', callback);
    };
  }

  public subscribeToCategories(callback: (categories: Category[]) => void): () => void {
    // Immediately call with current data if available
    if (this.categories.length > 0) {
      callback(this.categories);
    }
    
    // Subscribe to future changes
    this.eventEmitter.on('categoriesChanged', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('categoriesChanged', callback);
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

  // Get current data synchronously
  public getInventoryItems(): InventoryItem[] {
    return [...this.inventoryItems];
  }

  public getCategories(): Category[] {
    return [...this.categories];
  }

  // Cleanup method (optional - usually not needed due to singleton nature)
  public cleanup() {
    console.log('🧹 Cleaning up DataStore listeners');
    
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
  }

  // Method to restart listeners if needed
  public restartListeners() {
    console.log('🔄 Restarting DataStore listeners');
    this.cleanup();
    this.initializeListeners();
  }

  // Get listener status
  public getListenerStatus() {
    return {
      inventory: this.isInventoryListenerActive,
      categories: this.isCategoriesListenerActive,
      inventoryItemsCount: this.inventoryItems.length,
      categoriesCount: this.categories.length
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

export const getInventoryItems = () => {
  return dataStore.getInventoryItems();
};

export const getCategories = () => {
  return dataStore.getCategories();
};

// Export for debugging
export const getDataStoreStatus = () => {
  return dataStore.getListenerStatus();
};
