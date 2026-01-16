import { create } from 'zustand';
import { Movement } from '@/lib/types';
import { 
  getAllMovements,
  getMovementsByCategory,
  addMovement,
  updateMovement,
  deleteMovement,
  searchMovements,
  reorderMovementsInCategory,
  subscribeToMovementsByCategory,
  getNextOrdinal
} from '@/lib/firebase/services/movements';
import { executeMutation, createOptimisticArrayUpdate } from './mutationHelpers';

interface MovementStore {
  // State
  movements: Movement[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  currentCategoryId: string | null;
  
  // Actions
  fetchMovements: () => Promise<void>;
  fetchMovementsByCategory: (categoryId: string) => Promise<void>;
  addMovement: (movementData: Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'ordinal'>) => Promise<string>;
  editMovement: (id: string, updates: Partial<Omit<Movement, 'id' | 'createdAt'>>) => Promise<void>;
  removeMovement: (id: string) => Promise<void>;
  searchMovements: (searchTerm: string) => Promise<void>;
  reorderMovements: (categoryId: string, draggedIndex: number, dropIndex: number) => Promise<void>;
  setSearchTerm: (term: string) => void;
  setCurrentCategory: (categoryId: string | null) => void;
  clearError: () => void;
  
  // Real-time subscription
  subscribeToMovements: (categoryId: string) => () => void;
}

export const useMovementStore = create<MovementStore>((set, get) => ({
  // Initial State
  movements: [],
  loading: false,
  error: null,
  searchTerm: '',
  currentCategoryId: null,

  // Actions
  fetchMovements: async () => {
    set({ loading: true, error: null });
    try {
      const movements = await getAllMovements(true); // Include category data
      set({ movements, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch movements',
        loading: false 
      });
    }
  },

  fetchMovementsByCategory: async (categoryId) => {
    set({ loading: true, error: null, currentCategoryId: categoryId });
    try {
      const movements = await getMovementsByCategory(categoryId, true);
      set({ movements, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch movements',
        loading: false 
      });
    }
  },

  addMovement: async (movementData) => {
    return executeMutation(
      async () => {
        // Get next ordinal for the category
        const ordinal = await getNextOrdinal(movementData.categoryId);
        
        const id = await addMovement({
          ...movementData,
          ordinal
        });
        
        // Refresh movements for current category
        const { currentCategoryId } = get();
        if (currentCategoryId === movementData.categoryId) {
          await get().fetchMovementsByCategory(currentCategoryId);
        } else {
          // If not viewing this category, just add to all movements
          const { movements } = get();
          const newMovement: Movement = {
            ...movementData,
            id,
            ordinal,
            createdAt: new Date(),
            updatedAt: new Date()
          } as Movement;
          set({ movements: [...movements, newMovement] });
        }
        
        return id;
      },
      {
        optimisticUpdate: () => {
          // Optimistically add a temporary movement (will be replaced by real one)
          const { movements } = get();
          const tempMovement: Movement = {
            ...movementData,
            id: `temp-${Date.now()}`,
            ordinal: movements.filter(m => m.categoryId === movementData.categoryId).length,
            createdAt: new Date(),
            updatedAt: new Date()
          } as Movement;
          set({ movements: [...movements, tempMovement], loading: true, error: null });
        },
        rollback: () => {
          const { movements } = get();
          set({ movements: movements.filter(m => !m.id.startsWith('temp-')) });
        },
        onError: (error) => {
          set({ 
            error: error.message || 'Failed to add movement',
            loading: false 
          });
        },
        onSuccess: () => {
          set({ loading: false });
        }
      }
    );
  },

  editMovement: async (id, updates) => {
    return executeMutation(
      async () => {
        await updateMovement(id, updates);
        
        // Update local state
        const { movements } = get();
        const updatedMovements = movements.map(movement => 
          movement.id === id ? { ...movement, ...updates, updatedAt: new Date() } : movement
        );
        
        set({ movements: updatedMovements });
        return undefined;
      },
      {
        optimisticUpdate: () => {
          const { movements } = get();
          const optimistic = movements.map(movement => 
            movement.id === id ? { ...movement, ...updates } : movement
          );
          set({ movements: optimistic, loading: true, error: null });
        },
        rollback: () => {
          const { movements } = get();
          set({ movements });
        },
        onError: (error) => {
          set({ 
            error: error.message || 'Failed to update movement',
            loading: false 
          });
        },
        onSuccess: () => {
          set({ loading: false });
        }
      }
    );
  },

  removeMovement: async (id) => {
    return executeMutation(
      async () => {
        await deleteMovement(id);
        
        const { movements } = get();
        const filteredMovements = movements.filter(movement => movement.id !== id);
        
        set({ movements: filteredMovements });
        return undefined;
      },
      {
        optimisticUpdate: () => {
          const { movements } = get();
          const removed = movements.find(m => m.id === id);
          const filtered = movements.filter(movement => movement.id !== id);
          set({ movements: filtered, loading: true, error: null });
          return removed; // Return for rollback
        },
        rollback: (removed) => {
          if (removed) {
            const { movements } = get();
            set({ movements: [...movements, removed] });
          }
        },
        onError: (error) => {
          set({ 
            error: error.message || 'Failed to delete movement',
            loading: false 
          });
        },
        onSuccess: () => {
          set({ loading: false });
        }
      }
    );
  },

  searchMovements: async (searchTerm) => {
    set({ loading: true, error: null, searchTerm });
    try {
      const movements = await searchMovements(searchTerm, true);
      set({ movements, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to search movements',
        loading: false 
      });
    }
  },

  reorderMovements: async (categoryId, draggedIndex, dropIndex) => {
    // Optimistic update - don't set loading to avoid UI flicker during drag
    const { movements } = get();
    const categoryMovements = movements.filter(m => m.categoryId === categoryId);
    
    // Optimistically reorder in local state
    const reordered = [...categoryMovements];
    const [movedMovement] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, movedMovement);
    
    // Update ordinals optimistically
    const updatedMovements = movements.map(m => {
      if (m.categoryId === categoryId) {
        const newIndex = reordered.findIndex(rm => rm.id === m.id);
        if (newIndex !== -1) {
          return { ...m, ordinal: newIndex };
        }
      }
      return m;
    });
    
    set({ movements: updatedMovements });
    
    try {
      await reorderMovementsInCategory(categoryId, draggedIndex, dropIndex);
      // Silently refresh to ensure sync, but don't show loading
      await get().fetchMovementsByCategory(categoryId);
    } catch (error) {
      // Revert on error
      set({ movements });
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reorder movements'
      });
      throw error;
    }
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  setCurrentCategory: (categoryId) => {
    set({ currentCategoryId: categoryId });
  },

  clearError: () => {
    set({ error: null });
  },

  // Real-time subscription
  subscribeToMovements: (categoryId) => {
    set({ currentCategoryId: categoryId });
    return subscribeToMovementsByCategory(categoryId, (movements) => {
      set({ movements });
    });
  },
}));