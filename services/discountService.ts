import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
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
  branchId: string; // Branch ID for multi-branch support
  scope: 'all_branches' | 'specific_branch'; // Whether discount applies to all branches or specific branch
  created_at: Timestamp;
  modified_at: Timestamp;
  created_by: string; // user ID from Firebase Auth
}

const COLLECTION_NAME = 'discounts';

// Create a new discount (using discount_code as document ID)
export const createDiscount = async (
  discountData: Omit<Discount, 'id' | 'created_at' | 'modified_at'> & { created_by: string; branchId: string }
): Promise<string> => {
  try {
    // Validate that created_by and branchId are not undefined
    if (!discountData.created_by) {
      throw new Error('created_by field is required');
    }
    if (!discountData.branchId) {
      throw new Error('branchId field is required');
    }

    const docData = {
      discount_code: discountData.discount_code,
      type: discountData.type,
      value: discountData.value,
      applies_to: discountData.applies_to,
      branchId: discountData.branchId,
      scope: discountData.scope,
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

// Get all discounts for a specific branch (includes both branch-specific and all-branches discounts)
export const getDiscounts = async (branchId?: string): Promise<Discount[]> => {
  try {
    let q;
    if (branchId) {
      // Get discounts that either apply to all branches OR are specific to this branch
      q = query(
        collection(db, COLLECTION_NAME),
        orderBy('created_at', 'desc')
      );
    } else {
      q = query(collection(db, COLLECTION_NAME), orderBy('created_at', 'desc'));
    }
    
    const querySnapshot = await getDocs(q);
    
    const discounts: Discount[] = [];
    querySnapshot.forEach((doc) => {
      const discountData = doc.data() as Discount;
      
      // If branchId is provided, filter to include:
      // 1. Discounts with scope 'all_branches'
      // 2. Discounts with scope 'specific_branch' that match the branchId
      if (branchId) {
        if (discountData.scope === 'all_branches' || 
           (discountData.scope === 'specific_branch' && discountData.branchId === branchId)) {
          discounts.push({
            ...discountData,
            id: doc.id
          });
        }
      } else {
        // No branchId filter, return all discounts
        discounts.push({
          ...discountData,
          id: doc.id
        });
      }
    });
    
    console.log('Retrieved', discounts.length, 'discounts for branch:', branchId || 'all');
    return discounts;
  } catch (error) {
    console.error('Error fetching discounts:', error);
    throw new Error('Failed to fetch discounts');
  }
};

// Real-time listener for discounts for a specific branch (includes both branch-specific and all-branches discounts)
export const subscribeToDiscounts = (branchId: string, callback: (discounts: Discount[]) => void) => {
  try {
    // Query all discounts and filter in the callback
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('created_at', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const discounts: Discount[] = [];
      querySnapshot.forEach((doc) => {
        const discountData = doc.data() as Discount;
        
        // Include discounts that either apply to all branches OR are specific to this branch
        if (discountData.scope === 'all_branches' || 
           (discountData.scope === 'specific_branch' && discountData.branchId === branchId)) {
          discounts.push({
            ...discountData,
            id: doc.id
          });
        }
      });
      
      console.log('Real-time update: Retrieved', discounts.length, 'discounts for branch:', branchId);
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
    if (updates.scope !== undefined) updateData.scope = updates.scope;
    if (updates.branchId !== undefined) updateData.branchId = updates.branchId;
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

// Get discount by code (now branch-specific)
export const getDiscountByCode = async (discount_code: string, branchId?: string): Promise<Discount | null> => {
  try {
    const discounts = await getDiscounts(branchId);
    return discounts.find(discount => discount.discount_code === discount_code) || null;
  } catch (error) {
    console.error('Error getting discount by code:', error);
    throw new Error('Failed to get discount by code');
  }
};

// Validate discount code (now branch-specific)
export const validateDiscountCode = async (discount_code: string, branchId?: string): Promise<boolean> => {
  try {
    const discount = await getDiscountByCode(discount_code, branchId);
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

// Helper function to check if discount is empty (now branch-specific)
export const isDiscountsEmpty = async (branchId?: string): Promise<boolean> => {
  try {
    const discounts = await getDiscounts(branchId);
    return discounts.length === 0;
  } catch (error) {
    console.error('Error checking if discounts are empty:', error);
    return true; // Assume empty on error
  }
};

// Search discounts by code (now branch-specific)
export const searchDiscountsByCode = async (searchTerm: string, branchId?: string): Promise<Discount[]> => {
  try {
    const allDiscounts = await getDiscounts(branchId);
    
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
