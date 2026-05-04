import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { auth, getDb } from '../config';
import { resolveActiveAccountId } from './memberships';
import { WorkoutIntent } from '../../types';

export type { WorkoutIntent };

type WorkoutIntentSeed = Omit<WorkoutIntent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

async function resolveIntentOwnerId(): Promise<string | null> {
  const accountId = await resolveActiveAccountId();
  if (accountId) return accountId;

  // Fallback for single-user setups before membership bootstrap completes.
  return auth.currentUser?.uid || null;
}

const DEFAULT_WORKOUT_INTENTS: WorkoutIntentSeed[] = [
  {
    key: 'prep',
    name: 'Prep',
    color: '#3b82f6',
    description: 'Preparation and activation work to increase readiness and movement quality.',
    order: 0,
  },
  {
    key: 'potentiation',
    name: 'Potentiation',
    color: '#06b6d4',
    description: 'Fast, neural-primer work to elevate readiness before high-output lifting or sprinting.',
    order: 1,
  },
  {
    key: 'skill',
    name: 'Skill',
    color: '#0ea5e9',
    description: 'Technical practice emphasizing movement quality, rhythm, and repeatable execution.',
    order: 2,
  },
  {
    key: 'speed',
    name: 'Speed',
    color: '#22d3ee',
    description: 'High-velocity efforts with full intent and sufficient rest for quality output.',
    order: 3,
  },
  {
    key: 'power',
    name: 'Power',
    color: '#f97316',
    description: 'Explosive force development using jumps, throws, and dynamic loaded work.',
    order: 4,
  },
  {
    key: 'strength',
    name: 'Strength',
    color: '#ef4444',
    description: 'Primary loaded work for force production and strength progression.',
    order: 5,
  },
  {
    key: 'hypertrophy',
    name: 'Hypertrophy',
    color: '#f59e0b',
    description: 'Volume-based work to build tissue capacity, local muscular endurance, and size.',
    order: 6,
  },
  {
    key: 'accessory',
    name: 'Accessory',
    color: '#fbbf24',
    description: 'Supplemental work to support main lifts, tissue tolerance, and hypertrophy.',
    order: 7,
  },
  {
    key: 'core',
    name: 'Core',
    color: '#84cc16',
    description: 'Bracing and trunk integration focused on anti-extension, anti-rotation, and transfer.',
    order: 8,
  },
  {
    key: 'conditioning',
    name: 'Conditioning',
    color: '#10b981',
    description: 'Engine or work-capacity focused efforts, including ESD and interval work.',
    order: 9,
  },
  {
    key: 'amrap',
    name: 'AMRAP',
    color: '#8b5cf6',
    description: 'As-many-rounds/reps-as-possible effort with clear density and pacing targets.',
    order: 10,
  },
  {
    key: 'emom',
    name: 'EMOM',
    color: '#6366f1',
    description: 'Every-minute-on-the-minute structure with time-boxed effort and repeatability.',
    order: 11,
  },
  {
    key: 'plyo',
    name: 'Plyo',
    color: '#ec4899',
    description: 'Jump, bound, and reactive elastic work emphasizing power and stiffness control.',
    order: 12,
  },
  {
    key: 'testing',
    name: 'Testing',
    color: '#64748b',
    description: 'Assessment-focused work to benchmark readiness, capacity, and performance trends.',
    order: 13,
  },
  {
    key: 'rehab',
    name: 'Rehab',
    color: '#22c55e',
    description: 'Targeted return-to-function work focused on symptom-guided progression and control.',
    order: 14,
  },
  {
    key: 'recovery',
    name: 'Recovery',
    color: '#2dd4bf',
    description: 'Low-intensity restoration work focused on breathing, mobility, and tissue reset.',
    order: 15,
  },
  {
    key: 'cooldown',
    name: 'Cooldown',
    color: '#14b8a6',
    description: 'Downregulation and restoration work: breathing, mobility, and recovery focus.',
    order: 16,
  },
];

async function ensureDefaultWorkoutIntents(accountId: string): Promise<void> {
  const q = query(
    collection(getDb(), 'workoutIntents'),
    where('ownerId', '==', accountId)
  );
  const snapshot = await getDocs(q);

  // One-time seed migrations for older default intent sets.
  const existingDocs = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    data: docItem.data() as Record<string, unknown>,
  }));

  const hasPotentiation = existingDocs.some((item) => {
    const key = typeof item.data.key === 'string' ? item.data.key.trim().toLowerCase() : '';
    const name = typeof item.data.name === 'string' ? item.data.name.trim().toLowerCase() : '';
    return key === 'potentiation' || name === 'potentiation';
  });
  const ballisticsDoc = existingDocs.find((item) => {
    const key = typeof item.data.key === 'string' ? item.data.key.trim().toLowerCase() : '';
    const name = typeof item.data.name === 'string' ? item.data.name.trim().toLowerCase() : '';
    return key === 'ballistics' || name === 'ballistics';
  });

  if (ballisticsDoc && !hasPotentiation) {
    await updateDoc(doc(getDb(), 'workoutIntents', ballisticsDoc.id), {
      key: 'potentiation',
      name: 'Potentiation',
      color: '#06b6d4',
      description:
        'Fast, neural-primer work to elevate readiness before high-output lifting or sprinting.',
      updatedAt: Timestamp.now(),
    });
  }

  const hasConditioning = existingDocs.some((item) => {
    const key = typeof item.data.key === 'string' ? item.data.key.trim().toLowerCase() : '';
    const name = typeof item.data.name === 'string' ? item.data.name.trim().toLowerCase() : '';
    return key === 'conditioning' || name === 'conditioning';
  });
  const capacityDoc = existingDocs.find((item) => {
    const key = typeof item.data.key === 'string' ? item.data.key.trim().toLowerCase() : '';
    const name = typeof item.data.name === 'string' ? item.data.name.trim().toLowerCase() : '';
    return key === 'capacity' || name === 'capacity';
  });

  if (capacityDoc) {
    if (hasConditioning) {
      await deleteDoc(doc(getDb(), 'workoutIntents', capacityDoc.id));
    } else {
      await updateDoc(doc(getDb(), 'workoutIntents', capacityDoc.id), {
        key: 'conditioning',
        name: 'Conditioning',
        color: '#10b981',
        description: 'Engine or work-capacity focused efforts, including ESD and interval work.',
        updatedAt: Timestamp.now(),
      });
    }
  }

  // Re-read after migration updates/deletes before missing-default checks.
  const freshSnapshot = await getDocs(q);
  const existingByKey = new Set(
    freshSnapshot.docs
      .map((docItem) => {
        const data = docItem.data();
        return typeof data.key === 'string' ? data.key.trim().toLowerCase() : '';
      })
      .filter(Boolean)
  );
  const existingByName = new Set(
    freshSnapshot.docs
      .map((docItem) => {
        const data = docItem.data();
        return typeof data.name === 'string' ? data.name.trim().toLowerCase() : '';
      })
      .filter(Boolean)
  );

  const missingDefaults = DEFAULT_WORKOUT_INTENTS.filter(
    (intent) => !existingByKey.has(intent.key) && !existingByName.has(intent.name.trim().toLowerCase())
  );

  if (missingDefaults.length === 0) {
    return;
  }

  await Promise.all(
    missingDefaults.map((intent) =>
      addDoc(collection(getDb(), 'workoutIntents'), {
        ...intent,
        ownerId: accountId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    )
  );
}

export const createWorkoutIntent = async (
  workoutIntent: Omit<WorkoutIntent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
): Promise<string> => {
  const ownerId = await resolveIntentOwnerId();
  if (!ownerId) {
    throw new Error('Unauthorized or No Active Account');
  }

  const docRef = await addDoc(collection(getDb(), 'workoutIntents'), {
    ...workoutIntent,
    ownerId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateWorkoutIntent = async (
  id: string,
  updates: Partial<Omit<WorkoutIntent, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  const workoutIntentRef = doc(getDb(), 'workoutIntents', id);
  await updateDoc(workoutIntentRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteWorkoutIntent = async (id: string): Promise<void> => {
  const workoutIntentRef = doc(getDb(), 'workoutIntents', id);
  await deleteDoc(workoutIntentRef);
};

export const fetchWorkoutIntents = async (): Promise<WorkoutIntent[]> => {
  const ownerId = await resolveIntentOwnerId();
  if (!ownerId) return [];

  await ensureDefaultWorkoutIntents(ownerId);

  const q = query(
    collection(getDb(), 'workoutIntents'),
    where('ownerId', '==', ownerId)
  );
  const querySnapshot = await getDocs(q);

  const intents = querySnapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  })) as WorkoutIntent[];

  return intents.sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || '').localeCompare(b.name || '');
  });
};
