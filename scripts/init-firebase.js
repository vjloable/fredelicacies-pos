// Simple script to initialize Firebase collections
import { db } from '../firebase-config.js';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

async function initializeCollections() {
  try {
    console.log('🔥 Initializing Firebase collections...');
    
    // Create a default category
    const categoryRef = await addDoc(collection(db, 'categories'), {
      name: 'Default',
      color: '#3B82F6',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log('✅ Created default category:', categoryRef.id);
    
    // Create a sample inventory item
    const inventoryRef = await addDoc(collection(db, 'inventory'), {
      name: 'Sample Item',
      price: 10.00,
      cost: 5.00,
      categoryId: categoryRef.id,
      stock: 10,
      description: 'Sample inventory item',
      imgUrl: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log('✅ Created sample inventory item:', inventoryRef.id);
    
    console.log('🎉 Firebase collections initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing Firebase collections:', error);
  }
}

initializeCollections();
