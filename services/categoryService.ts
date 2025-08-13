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

export interface Category {
  id?: string;
  name: string;
  color: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'categories';

// Create a new category
export const createCategory = async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docData = {
      ...categoryData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

// Get all categories
export const getCategories = async (): Promise<Category[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
};

// Subscribe to categories changes
export const subscribeToCategories = (callback: (categories: Category[]) => void): (() => void) | null => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const categories: Category[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      callback(categories);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to categories:', error);
    return null;
  }
};

// Update a category
export const updateCategory = async (id: string, updates: Partial<Category>): Promise<void> => {
  try {
    const categoryRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(categoryRef, updateData);
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

// Delete a category
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    const categoryRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(categoryRef);
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Helper function to get category by ID
export const getCategoryById = (categories: Category[], categoryId: string): Category | undefined => {
  return categories.find(cat => cat.id === categoryId);
};

// Helper function to get category name by ID
export const getCategoryName = (categories: Category[], categoryId: string): string => {
  const category = getCategoryById(categories, categoryId);
  return category?.name || "Unknown";
};

// Helper function to get category color by ID
export const getCategoryColor = (categories: Category[], categoryId: string): string => {
  const category = getCategoryById(categories, categoryId);
  return category?.color || "#6B7280";
};
