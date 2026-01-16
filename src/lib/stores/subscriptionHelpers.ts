/**
 * Subscription helpers for Zustand stores
 * Prevents unnecessary re-renders by comparing data before updating state
 */

/**
 * Compare two arrays by their IDs to detect actual content changes
 * Returns true if content changed, false if only reference changed
 */
export function arraysEqualById<T extends { id: string }>(
  arr1: T[],
  arr2: T[]
): boolean {
  if (arr1.length !== arr2.length) return false;
  
  const ids1 = new Set(arr1.map(item => item.id));
  const ids2 = new Set(arr2.map(item => item.id));
  
  if (ids1.size !== ids2.size) return false;
  
  for (const id of ids1) {
    if (!ids2.has(id)) return false;
  }
  
  return true;
}

/**
 * Update state only if content actually changed
 * Prevents unnecessary re-renders from reference-only changes
 */
export function updateIfChanged<T>(
  current: T,
  incoming: T,
  setState: (value: T) => void,
  compareFn?: (a: T, b: T) => boolean
): boolean {
  // Use custom compare function if provided
  if (compareFn) {
    if (compareFn(current, incoming)) {
      return false; // No change
    }
  } else if (Array.isArray(current) && Array.isArray(incoming)) {
    // For arrays, compare by IDs if items have id property
    if ((incoming as any[]).length > 0 && typeof (incoming as any[])[0]?.id === 'string') {
      if (arraysEqualById(current as any[], incoming as any[])) {
        return false; // No change
      }
    } else if (JSON.stringify(current) === JSON.stringify(incoming)) {
      return false; // No change (deep equality)
    }
  } else if (current === incoming) {
    return false; // No change (reference equality)
  }
  
  // Content changed, update state
  setState(incoming);
  return true;
}

/**
 * Create a subscription handler that only updates if content changed
 */
export function createOptimizedSubscription<T>(
  setState: (value: T) => void,
  compareFn?: (a: T, b: T) => boolean
) {
  let lastValue: T | null = null;
  
  return (newValue: T) => {
    if (lastValue === null) {
      // First update, always set
      lastValue = newValue;
      setState(newValue);
      return;
    }
    
    // Check if content changed
    if (compareFn) {
      if (!compareFn(lastValue, newValue)) {
        lastValue = newValue;
        setState(newValue);
      }
    } else if (Array.isArray(lastValue) && Array.isArray(newValue)) {
      // For arrays, compare by IDs
      if ((newValue as any[]).length > 0 && typeof (newValue as any[])[0]?.id === 'string') {
        if (!arraysEqualById(lastValue as any[], newValue as any[])) {
          lastValue = newValue;
          setState(newValue);
        }
      } else if (JSON.stringify(lastValue) !== JSON.stringify(newValue)) {
        lastValue = newValue;
        setState(newValue);
      }
    } else if (lastValue !== newValue) {
      lastValue = newValue;
      setState(newValue);
    }
  };
}
