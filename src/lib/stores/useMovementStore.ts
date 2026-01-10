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
    set({ loading: true, error: null });
    try {
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
      }
      
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add movement',
        loading: false 
      });
      throw error;
    }
  },

  editMovement: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await updateMovement(id, updates);
      
      // Update local state
      const { movements } = get();
      const updatedMovements = movements.map(movement => 
        movement.id === id ? { ...movement, ...updates } : movement
      );
      
      set({ movements: updatedMovements, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update movement',
        loading: false 
      });
      throw error;
    }
  },

  removeMovement: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteMovement(id);
      
      const { movements } = get();
      const filteredMovements = movements.filter(movement => movement.id !== id);
      
      set({ movements: filteredMovements, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete movement',
        loading: false 
      });
      throw error;
    }
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
    set({ loading: true, error: null });
    try {
      await reorderMovementsInCategory(categoryId, draggedIndex, dropIndex);
      
      // Refresh movements for the category
      await get().fetchMovementsByCategory(categoryId);
      
      set({ loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reorder movements',
        loading: false 
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