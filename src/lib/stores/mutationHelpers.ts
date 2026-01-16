/**
 * Unified mutation helpers for Zustand stores
 * Provides optimistic updates, error handling, and rollback capabilities
 */

export interface MutationOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  optimisticUpdate?: () => void | any; // Can return data for rollback
  rollback?: (data?: any) => void; // Receives data from optimisticUpdate if returned
  showError?: boolean;
}

/**
 * Execute a mutation with optimistic updates and error handling
 */
export async function executeMutation<T>(
  mutationFn: () => Promise<T>,
  options: MutationOptions<T> = {}
): Promise<T> {
  const { optimisticUpdate, rollback, onSuccess, onError, showError = true } = options;

  // Apply optimistic update if provided
  let rollbackData: any = undefined;
  if (optimisticUpdate) {
    rollbackData = optimisticUpdate();
  }

  try {
    const result = await mutationFn();
    
    if (onSuccess) {
      onSuccess(result);
    }
    
    return result;
  } catch (error) {
    // Rollback optimistic update on error
    if (rollback) {
      rollback(rollbackData);
    }
    
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    if (onError) {
      onError(errorObj);
    }
    
    if (showError) {
      console.error('Mutation failed:', errorObj);
    }
    
    throw errorObj;
  }
}

/**
 * Retry a mutation with exponential backoff
 */
export async function retryMutation<T>(
  mutationFn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await mutationFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Mutation failed after retries');
}

/**
 * Create an optimistic update handler for array mutations
 */
export function createOptimisticArrayUpdate<T extends { id: string }>(
  currentItems: T[],
  setItems: (items: T[]) => void
) {
  return {
    add: (newItem: T) => {
      setItems([...currentItems, newItem]);
      return () => setItems(currentItems);
    },
    update: (id: string, updates: Partial<T>) => {
      const updated = currentItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
      setItems(updated);
      return () => setItems(currentItems);
    },
    remove: (id: string) => {
      const filtered = currentItems.filter(item => item.id !== id);
      setItems(filtered);
      return () => setItems(currentItems);
    },
    reorder: (fromIndex: number, toIndex: number) => {
      const reordered = [...currentItems];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      setItems(reordered);
      return () => setItems(currentItems);
    }
  };
}
