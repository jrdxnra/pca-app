/**
 * Bulk Import Rebrand Fitness movements to PCA
 * 
 * This script expects a JSON file from rebrand-scraper with format:
 * {
 *   categories: [{ name: string, color: string }],
 *   movements: { [categoryName]: [{ name: string, ordinal: number }] }
 * }
 */

import { addMovement, getAllMovements } from '@/lib/firebase/services/movements';
import { getAllMovementCategories } from '@/lib/firebase/services/movementCategories';
import { Movement } from '@/lib/types';

// Default configurations based on movement type
const getDefaultConfig = (movementName: string): Movement['configuration'] => {
  const name = movementName.toLowerCase();
  
  // Common patterns for configuration
  if (name.includes('run') || name.includes('walk') || name.includes('bike') || name.includes('row')) {
    return {
      use_reps: false,
      use_tempo: false,
      use_time: true,
      use_weight: false,
      weight_measure: 'lbs',
      use_distance: true,
      distance_measure: 'mi',
      use_pace: true,
      pace_measure: 'mi',
      unilateral: false,
      use_percentage: false,
      use_rpe: false,
    };
  }
  
  if (name.includes('cardio') || name.includes('conditioning') || name.includes('amrap') || name.includes('emom')) {
    return {
      use_reps: true,
      use_tempo: false,
      use_time: true,
      use_weight: false,
      weight_measure: 'lbs',
      use_distance: false,
      distance_measure: 'm',
      use_pace: false,
      pace_measure: 'km',
      unilateral: false,
      use_percentage: false,
      use_rpe: false,
    };
  }
  
  if (name.includes('carry') || name.includes('walk')) {
    return {
      use_reps: false,
      use_tempo: false,
      use_time: true,
      use_weight: true,
      weight_measure: 'lbs',
      use_distance: true,
      distance_measure: 'yd',
      use_pace: false,
      pace_measure: 'km',
      unilateral: false,
      use_percentage: false,
      use_rpe: false,
    };
  }
  
  if (name.includes('plank') || name.includes('hold') || name.includes('supine') || name.includes('prone')) {
    return {
      use_reps: false,
      use_tempo: false,
      use_time: true,
      use_weight: false,
      weight_measure: 'lbs',
      use_distance: false,
      distance_measure: 'm',
      use_pace: false,
      pace_measure: 'km',
      unilateral: false,
      use_percentage: false,
      use_rpe: false,
    };
  }
  
  if (name.includes('warm') || name.includes('mobility') || name.includes('stretch')) {
    return {
      use_reps: true,
      use_tempo: false,
      use_time: false,
      use_weight: false,
      weight_measure: 'lbs',
      use_distance: false,
      distance_measure: 'm',
      use_pace: false,
      pace_measure: 'km',
      unilateral: false,
      use_percentage: false,
      use_rpe: false,
    };
  }
  
  // Default for resistance training (most movements)
  return {
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
    use_rpe: false,
  };
};

/**
 * Import movements from Rebrand Fitness JSON
 */
export async function importRebrandMovements(jsonData: {
  categories: Array<{ name: string; color: string }>;
  movements: { [categoryName: string]: Array<{ name: string; ordinal: number }> };
}) {
  console.log('🚀 Starting Rebrand Fitness import...');
  
  try {
    // Get existing data
    const existingCategories = await getAllMovementCategories();
    const existingMovements = await getAllMovements();
    
    console.log(`📋 Found ${existingCategories.length} existing categories`);
    console.log(`💪 Found ${existingMovements.length} existing movements`);
    
    // Create category map
    const categoryMap = new Map<string, string>();
    existingCategories.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    });
    
    // Import movements
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const [categoryName, movements] of Object.entries(jsonData.movements)) {
      // Find matching category
      const categoryId = categoryMap.get(categoryName.toLowerCase());
      
      if (!categoryId) {
        console.warn(`⚠️  Category "${categoryName}" not found, skipping movements`);
        continue;
      }
      
      console.log(`\n📦 Importing ${movements.length} movements for "${categoryName}"...`);
      
      for (const movement of movements) {
        try {
          // Check if movement already exists
          const exists = existingMovements.find(m => 
            m.name.toLowerCase() === movement.name.toLowerCase() && 
            m.categoryId === categoryId
          );
          
          if (exists) {
            console.log(`⏭️  Skipping "${movement.name}" (already exists)`);
            skipped++;
            continue;
          }
          
          // Get appropriate configuration
          const configuration = getDefaultConfig(movement.name);
          
          // Add movement
          await addMovement({
            name: movement.name,
            categoryId,
            ordinal: movement.ordinal,
            configuration,
            links: [],
          });
          
          console.log(`✅ Imported "${movement.name}"`);
          imported++;
          
        } catch (error) {
          console.error(`❌ Error importing "${movement.name}":`, error);
          errors++;
        }
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('🎉 Import complete!');
    
    return { imported, skipped, errors };
    
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    throw error;
  }
}

