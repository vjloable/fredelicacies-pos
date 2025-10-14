import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot,
  Timestamp, 
  where
} from 'firebase/firestore';
import { db } from '../firebase-config';

export interface InventoryItem {
  id?: string;
  name: string;
  price: number;
  cost?: number; // Optional cost field for cost tracking
  categoryId: string; // Changed from number to string
  stock: number;
  description: string;
  imgUrl?: string;
  branchId: string; // Branch ID field within the document
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Category {
  id: string; // Changed from number to string
  name: string;
  color: string;
}

const COLLECTION_NAME = 'inventory';

// Create a new inventory item
export const createInventoryItem = async (branchId: string, item: Omit<InventoryItem, 'id' | 'branchId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const itemData = {
      ...item,
      branchId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), itemData);
    console.log('Inventory item created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating inventory item:', error);
    throw new Error('Failed to create inventory item');
  }
};

// Get all inventory items for a branch
export const getInventoryItems = async (branchId: string): Promise<InventoryItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const items: InventoryItem[] = [];
    querySnapshot.forEach((doc) => {
      items.push({
        id: doc.id,
        ...doc.data()
      } as InventoryItem);
    });
    
    console.log('Retrieved', items.length, 'inventory items');
    return items;
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    throw new Error('Failed to fetch inventory items');
  }
};

// Real-time listener for inventory items
export const subscribeToInventoryItems = (branchId: string, callback: (items: InventoryItem[]) => void) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items: InventoryItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data()
        } as InventoryItem);
      });
      
      console.log('Real-time update: Retrieved', items.length, 'inventory items');
      callback(items);
    }, (error) => {
      console.error('Error in inventory items subscription:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up inventory items subscription:', error);
    throw new Error('Failed to set up real-time inventory updates');
  }
};

// Update an inventory item
export const updateInventoryItem = async (branchId: string, id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    const itemRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...updates,
      branchId, // Ensure branchId is maintained
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(itemRef, updateData);
    console.log('Inventory item updated:', id);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw new Error('Failed to update inventory item');
  }
};

// Delete an inventory item
export const deleteInventoryItem = async (branchId: string, id: string): Promise<void> => {
  try {
    const itemRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(itemRef);
    console.log('Inventory item deleted:', id);
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw new Error('Failed to delete inventory item');
  }
};

// Helper function to check if inventory is empty
export const isInventoryEmpty = async (branchId: string): Promise<boolean> => {
  try {
    const items = await getInventoryItems(branchId);
    return items.length === 0;
  } catch (error) {
    console.error('Error checking if inventory is empty:', error);
    return true; // Assume empty on error
  }
};

// Bulk operations
export const bulkUpdateStock = async (branchId: string, updates: { id: string; stock: number }[]): Promise<void> => {
  try {
    // Get current items to calculate new stock values
    const currentItems = await getInventoryItems(branchId);
    const itemsMap = new Map(currentItems.map(item => [item.id, item]));
    
    const updatePromises = updates.map(({ id, stock }) => {
      const currentItem = itemsMap.get(id);
      if (!currentItem) {
        console.warn(`Item with ID ${id} not found for stock update`);
        return Promise.resolve();
      }
      
      // Calculate new stock: current stock + stock change (stock is negative for sales)
      const newStock = Math.max(0, currentItem.stock + stock);
      console.log(`Updating stock for ${currentItem.name}: ${currentItem.stock} + (${stock}) = ${newStock}`);
      
      return updateInventoryItem(branchId, id, { stock: newStock });
    });
    
    await Promise.all(updatePromises);
    console.log('Bulk stock update completed for', updates.length, 'items');
  } catch (error) {
    console.error('Error in bulk stock update:', error);
    throw new Error('Failed to update stock for multiple items');
  }
};

// Search and filter functions
export const searchInventoryItems = async (branchId: string, searchTerm: string): Promise<InventoryItem[]> => {
  try {
    const allItems = await getInventoryItems(branchId);
    
    const filteredItems = allItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log('Search for "' + searchTerm + '" returned', filteredItems.length, 'items');
    return filteredItems;
  } catch (error) {
    console.error('Error searching inventory items:', error);
    throw new Error('Failed to search inventory items');
  }
};

// Search items by category
export const searchItemsByCategory = async (branchId: string, categoryId: string): Promise<InventoryItem[]> => {
  try {
    const allItems = await getInventoryItems(branchId);
    const categoryItems = allItems.filter(item => item.categoryId === categoryId);
    return categoryItems;
  } catch (error) {
    console.error('Error searching items by category:', error);
    throw error;
  }
};

// Stock management helpers
export const getLowStockItems = async (branchId: string, threshold: number = 5): Promise<InventoryItem[]> => {
  try {
    const allItems = await getInventoryItems(branchId);
    
    const lowStockItems = allItems.filter(item => item.stock <= threshold);
    
    console.log('Found', lowStockItems.length, 'low stock items (threshold:', threshold + ')');
    return lowStockItems;
  } catch (error) {
    console.error('Error getting low stock items:', error);
    throw new Error('Failed to get low stock items');
  }
};

// Note: getInventoryByBranch is now handled by getInventoryItems
// Note: addItemToBranch is now handled by createInventoryItem  
// Note: updateItemInBranch is now handled by updateInventoryItem