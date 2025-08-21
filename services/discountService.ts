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
  setDoc 
} from 'firebase/firestore';
import { db } from '../firebase-config';

export interface Discount {
  id: string; // This will be the discount_code
  discount_code: string; // Same as id
  type: 'percentage' | 'flat';
  value: number;
  applies_to: string | null; // category document ID or null for all
  created_at: Timestamp;
  modified_at: Timestamp;
  created_by: string; // user ID from Firebase Auth
}

const COLLECTION_NAME = 'discounts';

// Create a new discount (using discount_code as document ID)
export const createDiscount = async (
  discountData: Omit<Discount, 'id' | 'created_at' | 'modified_at'> & { created_by: string }
): Promise<string> => {
  try {
    // Validate that created_by is not undefined
    if (!discountData.created_by) {
      throw new Error('created_by field is required');
    }

    const docData = {
      discount_code: discountData.discount_code,
      type: discountData.type,
      value: discountData.value,
      applies_to: discountData.applies_to,
      created_by: discountData.created_by,
      created_at: Timestamp.now(),
      modified_at: Timestamp.now()
    };
    
    // Use discount_code as document ID
    const discountRef = doc(db, COLLECTION_NAME, discountData.discount_code);
    await setDoc(discountRef, docData);
    
    console.log('Discount created with ID:', discountData.discount_code);
    return discountData.discount_code;
  } catch (error) {
    console.error('Error creating discount:', error);
    throw new Error('Failed to create discount');
  }
};

// Get all discounts
export const getDiscounts = async (): Promise<Discount[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const discounts: Discount[] = [];
    querySnapshot.forEach((doc) => {
      discounts.push({
        id: doc.id,
        ...doc.data()
      } as Discount);
    });
    
    console.log('Retrieved', discounts.length, 'discounts');
    return discounts;
  } catch (error) {
    console.error('Error fetching discounts:', error);
    throw new Error('Failed to fetch discounts');
  }
};

// Real-time listener for discounts
export const subscribeToDiscounts = (callback: (discounts: Discount[]) => void) => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const discounts: Discount[] = [];
      querySnapshot.forEach((doc) => {
        discounts.push({
          id: doc.id,
          ...doc.data()
        } as Discount);
      });
      
      console.log('Real-time update: Retrieved', discounts.length, 'discounts');
      callback(discounts);
    }, (error) => {
      console.error('Error in discounts subscription:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up discounts subscription:', error);
    throw new Error('Failed to set up real-time discount updates');
  }
};

// Update a discount
export const updateDiscount = async (
  discount_code: string, 
  updates: Partial<Omit<Discount, 'id' | 'discount_code' | 'created_at' | 'created_by'>> & { modified_by?: string }
): Promise<void> => {
  try {
    const discountRef = doc(db, COLLECTION_NAME, discount_code);
    
    // Create update data object, filtering out undefined values
    const updateData: any = {
      modified_at: Timestamp.now()
    };
    
    // Only add fields that are not undefined
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.value !== undefined) updateData.value = updates.value;
    if (updates.applies_to !== undefined) updateData.applies_to = updates.applies_to;
    if (updates.modified_by !== undefined) updateData.modified_by = updates.modified_by;
    
    await updateDoc(discountRef, updateData);
    console.log('Discount updated:', discount_code);
  } catch (error) {
    console.error('Error updating discount:', error);
    throw new Error('Failed to update discount');
  }
};

// Delete a discount
export const deleteDiscount = async (discount_code: string): Promise<void> => {
  try {
    const discountRef = doc(db, COLLECTION_NAME, discount_code);
    await deleteDoc(discountRef);
    console.log('Discount deleted:', discount_code);
  } catch (error) {
    console.error('Error deleting discount:', error);
    throw new Error('Failed to delete discount');
  }
};

// Get discount by code
export const getDiscountByCode = async (discount_code: string): Promise<Discount | null> => {
  try {
    const discounts = await getDiscounts();
    return discounts.find(discount => discount.discount_code === discount_code) || null;
  } catch (error) {
    console.error('Error getting discount by code:', error);
    throw new Error('Failed to get discount by code');
  }
};

// Validate discount code
export const validateDiscountCode = async (discount_code: string): Promise<boolean> => {
  try {
    const discount = await getDiscountByCode(discount_code);
    return discount !== null;
  } catch (error) {
    console.error('Error validating discount code:', error);
    return false;
  }
};

// Calculate discount amount
export const calculateDiscountAmount = (
  discount: Discount, 
  subtotal: number, 
  categoryIds: string[] = []
): number => {
  // If discount applies to specific category and none of the items match
  if (discount.applies_to && !categoryIds.includes(discount.applies_to)) {
    return 0;
  }
  
  if (discount.type === 'percentage') {
    return Math.round((subtotal * discount.value / 100) * 100) / 100; // Round to 2 decimal places
  } else {
    return Math.min(discount.value, subtotal); // Flat discount can't exceed subtotal
  }
};

// Helper function to check if discount is empty
export const isDiscountsEmpty = async (): Promise<boolean> => {
  try {
    const discounts = await getDiscounts();
    return discounts.length === 0;
  } catch (error) {
    console.error('Error checking if discounts are empty:', error);
    return true; // Assume empty on error
  }
};

// Search discounts by code
export const searchDiscountsByCode = async (searchTerm: string): Promise<Discount[]> => {
  try {
    const allDiscounts = await getDiscounts();
    
    const filteredDiscounts = allDiscounts.filter(discount => 
      discount.discount_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log('Search for "' + searchTerm + '" returned', filteredDiscounts.length, 'discounts');
    return filteredDiscounts;
  } catch (error) {
    console.error('Error searching discounts:', error);
    throw new Error('Failed to search discounts');
  }
};
