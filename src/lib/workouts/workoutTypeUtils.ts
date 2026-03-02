import { WorkoutType } from '@/lib/firebase/services/workoutTypes';

const normalizeWorkoutTypeName = (value?: string | null): string => {
  return (value ?? '').trim().toLowerCase();
};

export function resolveWorkoutType(
  workoutTypes: WorkoutType[] = [],
  workoutTypeId?: string | null,
  workoutTypeName?: string | null
): WorkoutType | undefined {
  if (!Array.isArray(workoutTypes) || workoutTypes.length === 0) {
    return undefined;
  }

  if (workoutTypeId) {
    const exactMatch = workoutTypes.find((wt) => wt.id === workoutTypeId);
    if (exactMatch) {
      return exactMatch;
    }
  }

  if (workoutTypeName) {
    const normalizedTarget = normalizeWorkoutTypeName(workoutTypeName);
    if (normalizedTarget) {
      return workoutTypes.find((wt) => normalizeWorkoutTypeName(wt.name) === normalizedTarget);
    }
  }

  return undefined;
}

export function resolveWorkoutTypeColor(
  workoutTypes: WorkoutType[] = [],
  workoutTypeId?: string | null,
  workoutTypeName?: string | null,
  fallbackColor = '#6b7280'
): string {
  return resolveWorkoutType(workoutTypes, workoutTypeId, workoutTypeName)?.color || fallbackColor;
}
