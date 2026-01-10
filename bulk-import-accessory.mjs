#!/usr/bin/env node
/**
 * Bulk import Accessory movements from Rebrand Fitness to PCA
 * This will add all movements programmatically instead of using the UI
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

// Your Firebase config (you'll need to get this from your app)
const firebaseConfig = {
  // Add your Firebase config here
  // Get this from src/lib/firebase/config.ts or Firebase Console
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Accessory movements from Rebrand Fitness
const accessoryMovements = [
  'Curl - EZ Bar',
  'Curl - Straight Bar',
  'Rev Grip Curl + OH Press',
  'Rev Grip Curl',
  'Cable Curl',
  'Preacher Curl',
  'DB Hammer Curl',
  'DB Curl',
  'Alt DB Curl',
  'Wide Arm Curl',
  'Banded Curl',
  'Bicep Curl - TRX',
  'Lengthened Curl Variation',
  'Plate Curls',
  'Lateral + Front Raises',
  'Front Raises',
  'Lateral Raises',
  'Rear Delt Flies',
  'Skullcrusher',
  'Tricep Dips',
  'Bench Tricep Dips',
  'Tricep Kickback',
  'Tricep Extension',
  'Tricep Extension - SA',
  'Overhead Tricep Extension',
  'Serratus Press Variation',
  'Machine Tricep Ext',
  'Wrist Curls',
  'Wrist Flexion',
  'Wrist Rotations',
  'Calf Raises',
  'Calf Raises - SS',
  'Supermans',
  'Prone Leg Lifts'
];

// Default configuration for all movements
const defaultConfig = {
  use_reps: true,
  use_tempo: false,
  use_time: false,
  use_weight: true,
  weight_measure: 'lbs',
  use_distance: false,
  distance_measure: 'm',
  use_pace: false,
  pace_measure: 'km',
  unilateral: false,
  use_percentage: false,
  use_rpe: false
};

async function getCategoryId(categoryName) {
  try {
    const categoriesRef = collection(db, 'movement-categories');
    const q = query(categoriesRef, where('name', '==', categoryName));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.error(`Category "${categoryName}" not found`);
      return null;
    }
    
    return snapshot.docs[0].id;
  } catch (error) {
    console.error('Error getting category:', error);
    return null;
  }
}

async function bulkImportMovements() {
  console.log('Starting bulk import...');
  
  // Get the Accessory category ID
  const categoryId = await getCategoryId('Accessory');
  if (!categoryId) {
    console.error('Could not find Accessory category');
    return;
  }
  
  console.log(`Found Accessory category: ${categoryId}`);
  console.log(`Importing ${accessoryMovements.length} movements...`);
  
  // Import each movement
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < accessoryMovements.length; i++) {
    const movementName = accessoryMovements[i];
    
    try {
      const movementData = {
        name: movementName,
        categoryId: categoryId,
        ordinal: i + 1,
        configuration: defaultConfig,
        links: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      await addDoc(collection(db, 'movements'), movementData);
      console.log(`✓ ${i + 1}. ${movementName}`);
      successCount++;
    } catch (error) {
      console.error(`✗ ${i + 1}. ${movementName} - Error:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n=== Import Complete ===');
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the import
bulkImportMovements().catch(console.error);

