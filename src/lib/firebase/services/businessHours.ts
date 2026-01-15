import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, getDb } from '../config';

const DOC_ID = 'business-hours';

export interface DayHours {
  startHour: number;
  endHour: number;
}

export interface BusinessHours {
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayHours: { [dayIndex: number]: DayHours }; // Per-day hours: { 1: { startHour: 7, endHour: 16 }, ... }
}

const DEFAULT_DAY_HOURS: DayHours = { startHour: 7, endHour: 20 };
const DEFAULT_HOURS: BusinessHours = { 
  daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  dayHours: {
    1: { startHour: 7, endHour: 20 },  // Monday
    2: { startHour: 7, endHour: 20 },  // Tuesday
    3: { startHour: 7, endHour: 20 },  // Wednesday
    4: { startHour: 7, endHour: 20 },  // Thursday
    5: { startHour: 7, endHour: 20 },  // Friday
  }
};

export async function getBusinessHours(): Promise<BusinessHours> {
  try {
    const docRef = doc(getDb(), 'configuration', DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Migrate old format to new format if needed
      if (data.startHour !== undefined && data.endHour !== undefined && !data.dayHours) {
        // Old format - migrate to new format
        const migrated: BusinessHours = {
          daysOfWeek: data.daysOfWeek ?? DEFAULT_HOURS.daysOfWeek,
          dayHours: {}
        };
        (data.daysOfWeek ?? DEFAULT_HOURS.daysOfWeek).forEach((day: number) => {
          migrated.dayHours[day] = {
            startHour: data.startHour,
            endHour: data.endHour
          };
        });
        // Save migrated format
        await setDoc(docRef, migrated, { merge: true });
        return migrated;
      }
      
      return {
        daysOfWeek: data.daysOfWeek ?? DEFAULT_HOURS.daysOfWeek,
        dayHours: data.dayHours ?? DEFAULT_HOURS.dayHours
      };
    }
    
    // Create default if doesn't exist
    await setDoc(docRef, DEFAULT_HOURS);
    return DEFAULT_HOURS;
  } catch (error) {
    console.error('Error getting business hours:', error);
    return DEFAULT_HOURS;
  }
}

// Helper to get min/max hours across all selected days
export function getBusinessHoursRange(businessHours: BusinessHours | null): { startHour: number; endHour: number } {
  if (!businessHours || !businessHours.daysOfWeek || businessHours.daysOfWeek.length === 0) {
    return { startHour: 7, endHour: 20 };
  }
  
  let minHour = 24;
  let maxHour = 0;
  
  businessHours.daysOfWeek.forEach(dayIndex => {
    const dayHour = businessHours.dayHours?.[dayIndex];
    if (dayHour) {
      minHour = Math.min(minHour, dayHour.startHour);
      maxHour = Math.max(maxHour, dayHour.endHour);
    }
  });
  
  // Fallback if no valid hours found
  if (minHour === 24 || maxHour === 0) {
    return { startHour: 7, endHour: 20 };
  }
  
  return { startHour: minHour, endHour: maxHour };
}

export async function updateBusinessHoursInFirebase(hours: BusinessHours): Promise<void> {
  try {
    const docRef = doc(getDb(), 'configuration', DOC_ID);
    await setDoc(docRef, hours, { merge: true });
  } catch (error) {
    console.error('Error updating business hours:', error);
    throw error;
  }
}
