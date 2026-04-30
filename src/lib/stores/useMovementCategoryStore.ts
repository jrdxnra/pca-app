import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import { MovementCategory } from '@/lib/types';
import {
  getDefaultCategoryConfiguration,
  getDefaultCategoryDescription,
} from '@/lib/movements/defaultCategoryConfigurations';
import {
  getAllMovementCategories,
  addMovementCategory,
  updateMovementCategory,
  deleteMovementCategory,
  subscribeToMovementCategories,
  initializeDefaultCategories
} from '@/lib/firebase/services/movementCategories';

interface MovementCategoryStore {
  // State
  categories: MovementCategory[];
  selectedCategory: MovementCategory | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchCategories: () => Promise<void>;
  addCategory: (categoryData: Omit<MovementCategory, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editCategory: (id: string, updates: Partial<Omit<MovementCategory, 'id' | 'createdAt'>>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  setSelectedCategory: (category: MovementCategory | null) => void;
  clearError: () => void;
  initializeDefaults: () => Promise<void>;

  // Real-time subscription
  subscribeToCategories: (accountId: string) => () => void;
}

export const useMovementCategoryStore = create<MovementCategoryStore>((set, get) => ({
  // Initial State
  categories: [],
  selectedCategory: null,
  loading: false,
  error: null,

  // Actions
  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      let categories = await getAllMovementCategories();

      const categoriesMissingDefaults = categories.filter((category) => !category.defaultConfiguration);
      const categoriesMissingDescriptions = categories.filter(
        (category) => !category.description?.trim() && !!getDefaultCategoryDescription(category.name)
      );

      const categoriesNeedingBackfill = new Map<string, Partial<MovementCategory>>();

      if (categoriesMissingDefaults.length > 0) {
        categoriesMissingDefaults.forEach((category) => {
          categoriesNeedingBackfill.set(category.id, {
            ...(categoriesNeedingBackfill.get(category.id) || {}),
            defaultConfiguration: getDefaultCategoryConfiguration(category.name),
          });
        });
      }

      if (categoriesMissingDescriptions.length > 0) {
        categoriesMissingDescriptions.forEach((category) => {
          categoriesNeedingBackfill.set(category.id, {
            ...(categoriesNeedingBackfill.get(category.id) || {}),
            description: getDefaultCategoryDescription(category.name),
          });
        });
      }

      if (categoriesNeedingBackfill.size > 0) {
        await Promise.all(
          Array.from(categoriesNeedingBackfill.entries()).map(([id, updates]) =>
            updateMovementCategory(id, updates)
          )
        );
        categories = await getAllMovementCategories();
      }

      set({
        categories,
        loading: false,
        // Auto-select first category if none selected
        selectedCategory: get().selectedCategory || (categories.length > 0 ? categories[0] : null)
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch categories',
        loading: false
      });
    }
  },

  addCategory: async (categoryData) => {
    set({ loading: true, error: null });
    try {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 7);

      const id = await addMovementCategory({
        ...categoryData,
        importHighlight: {
          kind: 'new',
          source: 'manual',
          at: Timestamp.fromDate(now),
          expiresAt: Timestamp.fromDate(expiresAt),
        },
      });
      await get().fetchCategories(); // Refresh to get updated list
      set({ loading: false });
      return id;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add category',
        loading: false
      });
      throw error;
    }
  },

  editCategory: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await updateMovementCategory(id, updates);

      // Update local state
      const { categories, selectedCategory } = get();
      const updatedCategories = categories.map(category =>
        category.id === id ? { ...category, ...updates } : category
      );

      const updatedSelectedCategory = selectedCategory?.id === id
        ? { ...selectedCategory, ...updates }
        : selectedCategory;

      set({
        categories: updatedCategories,
        selectedCategory: updatedSelectedCategory,
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update category',
        loading: false
      });
      throw error;
    }
  },

  removeCategory: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteMovementCategory(id);

      const { categories, selectedCategory } = get();
      const filteredCategories = categories.filter(category => category.id !== id);

      // If deleted category was selected, select first remaining category
      const newSelectedCategory = selectedCategory?.id === id
        ? (filteredCategories.length > 0 ? filteredCategories[0] : null)
        : selectedCategory;

      set({
        categories: filteredCategories,
        selectedCategory: newSelectedCategory,
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete category',
        loading: false
      });
      throw error;
    }
  },

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
  },

  clearError: () => {
    set({ error: null });
  },

  initializeDefaults: async () => {
    set({ loading: true, error: null });
    try {
      await initializeDefaultCategories();
      await get().fetchCategories();
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize default categories',
        loading: false
      });
      throw error;
    }
  },

  // Real-time subscription
  subscribeToCategories: (accountId) => {
    return subscribeToMovementCategories(accountId, (categories) => {
      const { selectedCategory } = get();

      // Update categories
      set({ categories });

      // Update selected category if it still exists, otherwise select first
      if (selectedCategory) {
        const updatedSelectedCategory = categories.find(c => c.id === selectedCategory.id);
        if (updatedSelectedCategory) {
          set({ selectedCategory: updatedSelectedCategory });
        } else {
          set({ selectedCategory: categories.length > 0 ? categories[0] : null });
        }
      } else if (categories.length > 0) {
        set({ selectedCategory: categories[0] });
      }
    });
  },
}));
