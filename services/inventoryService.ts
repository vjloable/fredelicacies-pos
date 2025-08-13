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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase-config';

export interface InventoryItem {
  id?: string;
  name: string;
  price: number;
  categoryId: string; // Changed from number to string
  stock: number;
  description: string;
  imgUrl?: string;
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
export const createInventoryItem = async (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const itemData = {
      ...item,
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

// Get all inventory items
export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
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
export const subscribeToInventoryItems = (callback: (items: InventoryItem[]) => void) => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    
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
export const updateInventoryItem = async (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    const itemRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...updates,
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
export const deleteInventoryItem = async (id: string): Promise<void> => {
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
export const isInventoryEmpty = async (): Promise<boolean> => {
  try {
    const items = await getInventoryItems();
    return items.length === 0;
  } catch (error) {
    console.error('Error checking if inventory is empty:', error);
    return true; // Assume empty on error
  }
};

// Bulk operations
export const bulkUpdateStock = async (updates: { id: string; stock: number }[]): Promise<void> => {
  try {
    const updatePromises = updates.map(({ id, stock }) => 
      updateInventoryItem(id, { stock })
    );
    
    await Promise.all(updatePromises);
    console.log('Bulk stock update completed for', updates.length, 'items');
  } catch (error) {
    console.error('Error in bulk stock update:', error);
    throw new Error('Failed to update stock for multiple items');
  }
};

// Search and filter functions
export const searchInventoryItems = async (searchTerm: string): Promise<InventoryItem[]> => {
  try {
    const allItems = await getInventoryItems();
    
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
export const searchItemsByCategory = async (categoryId: string): Promise<InventoryItem[]> => {
  try {
    const allItems = await getInventoryItems();
    const categoryItems = allItems.filter(item => item.categoryId === categoryId);
    return categoryItems;
  } catch (error) {
    console.error('Error searching items by category:', error);
    throw error;
  }
};

// Stock management helpers
export const getLowStockItems = async (threshold: number = 5): Promise<InventoryItem[]> => {
  try {
    const allItems = await getInventoryItems();
    
    const lowStockItems = allItems.filter(item => item.stock <= threshold);
    
    console.log('Found', lowStockItems.length, 'low stock items (threshold:', threshold + ')');
    return lowStockItems;
  } catch (error) {
    console.error('Error getting low stock items:', error);
    throw new Error('Failed to get low stock items');
  }
};
