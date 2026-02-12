import { create } from 'zustand';
import {
  fetchPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
  Period
} from '@/lib/firebase/services/periods';
import {
  fetchWeekTemplates,
  createWeekTemplate,
  updateWeekTemplate,
  deleteWeekTemplate,
  WeekTemplate
} from '@/lib/firebase/services/weekTemplates';
import {
  fetchWorkoutCategories,
  createWorkoutCategory,
  updateWorkoutCategory,
  deleteWorkoutCategory,
  WorkoutCategory
} from '@/lib/firebase/services/workoutCategories';
import {
  fetchWorkoutTypes,
  createWorkoutType,
  updateWorkoutType,
  deleteWorkoutType,
  WorkoutType
} from '@/lib/firebase/services/workoutTypes';
import {
  fetchWorkoutStructureTemplates,
  createWorkoutStructureTemplate,
  updateWorkoutStructureTemplate,
  deleteWorkoutStructureTemplate
} from '@/lib/firebase/services/workoutStructureTemplates';
import {
  getBusinessHours,
  updateBusinessHoursInFirebase,
  BusinessHours
} from '@/lib/firebase/services/businessHours';
import {
  getAllWorkoutTemplates,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate
} from '@/lib/firebase/services/workouts';
import { WorkoutStructureTemplate, WorkoutTemplate } from '@/lib/types';

interface ConfigurationState {
  // Data
  periods: Period[];
  weekTemplates: WeekTemplate[];
  workoutCategories: WorkoutCategory[];
  workoutTypes: WorkoutType[];
  workoutStructureTemplates: WorkoutStructureTemplate[];
  workoutTemplates: WorkoutTemplate[]; // Full workout templates
  businessHours: BusinessHours | null;

  // Loading states
  loading: boolean;

  // Period actions
  fetchPeriods: () => Promise<void>;
  addPeriod: (period: Omit<Period, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updatePeriod: (id: string, updates: Partial<Omit<Period, 'id' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deletePeriod: (id: string) => Promise<void>;

  // Week template actions
  fetchWeekTemplates: () => Promise<void>;
  addWeekTemplate: (template: Omit<WeekTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateWeekTemplate: (id: string, updates: Partial<Omit<WeekTemplate, 'id' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deleteWeekTemplate: (id: string) => Promise<void>;

  // Workout category actions
  fetchWorkoutCategories: () => Promise<void>;
  addWorkoutCategory: (category: Omit<WorkoutCategory, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateWorkoutCategory: (id: string, updates: Partial<Omit<WorkoutCategory, 'id' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deleteWorkoutCategory: (id: string) => Promise<void>;

  // Workout type actions
  fetchWorkoutTypes: () => Promise<void>;
  addWorkoutType: (workoutType: Omit<WorkoutType, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateWorkoutType: (id: string, updates: Partial<Omit<WorkoutType, 'id' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deleteWorkoutType: (id: string) => Promise<void>;

  // Workout structure template actions
  fetchWorkoutStructureTemplates: () => Promise<void>;
  addWorkoutStructureTemplate: (template: Omit<WorkoutStructureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateWorkoutStructureTemplate: (id: string, updates: Partial<Omit<WorkoutStructureTemplate, 'id' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deleteWorkoutStructureTemplate: (id: string) => Promise<void>;

  // Workout template actions (Full Workouts)
  fetchFullWorkoutTemplates: () => Promise<void>;
  addFullWorkoutTemplate: (template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateFullWorkoutTemplate: (id: string, updates: Partial<Omit<WorkoutTemplate, 'id' | 'createdAt'>>) => Promise<void>;
  deleteFullWorkoutTemplate: (id: string) => Promise<void>;

  // Business hours actions
  fetchBusinessHours: () => Promise<void>;
  updateBusinessHours: (hours: BusinessHours) => Promise<void>;

  // Bulk fetch
  fetchAll: () => Promise<void>;
}

export const useConfigurationStore = create<ConfigurationState>((set, get) => ({
  // Initial state
  periods: [],
  weekTemplates: [],
  workoutCategories: [],
  workoutTypes: [],
  workoutStructureTemplates: [],
  workoutTemplates: [],
  businessHours: null,
  loading: false,

  // Period actions
  fetchPeriods: async () => {
    try {
      set({ loading: true });
      const periods = await fetchPeriods();
      set({ periods, loading: false });
    } catch (error) {
      console.error('Error fetching periods:', error);
      set({ loading: false });
    }
  },

  addPeriod: async (periodData) => {
    try {
      set({ loading: true });
      const id = await createPeriod(periodData);
      const newPeriod: Period = {
        ...periodData,
        id,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        createdBy: 'current-user'
      };
      set(state => ({
        periods: [...state.periods, newPeriod],
        loading: false
      }));
    } catch (error) {
      console.error('Error adding period:', error);
      set({ loading: false });
    }
  },

  updatePeriod: async (id, updates) => {
    try {
      set({ loading: true });
      await updatePeriod(id, updates);
      set(state => ({
        periods: state.periods.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date() as any } : p
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating period:', error);
      set({ loading: false });
    }
  },

  deletePeriod: async (id) => {
    try {
      set({ loading: true });
      await deletePeriod(id);
      set(state => ({
        periods: state.periods.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting period:', error);
      set({ loading: false });
    }
  },

  // Week template actions
  fetchWeekTemplates: async () => {
    try {
      set({ loading: true });
      const weekTemplates = await fetchWeekTemplates();
      set({ weekTemplates, loading: false });
    } catch (error) {
      console.error('Error fetching week templates:', error);
      set({ loading: false });
    }
  },

  addWeekTemplate: async (templateData) => {
    try {
      set({ loading: true });
      const id = await createWeekTemplate(templateData);
      const newTemplate: WeekTemplate = {
        ...templateData,
        id,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        createdBy: 'current-user'
      };
      set(state => ({
        weekTemplates: [...state.weekTemplates, newTemplate],
        loading: false
      }));
    } catch (error) {
      console.error('Error adding week template:', error);
      set({ loading: false });
    }
  },

  updateWeekTemplate: async (id, updates) => {
    try {
      set({ loading: true });
      await updateWeekTemplate(id, updates);
      set(state => ({
        weekTemplates: state.weekTemplates.map(t =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date() as any } : t
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating week template:', error);
      set({ loading: false });
    }
  },

  deleteWeekTemplate: async (id) => {
    try {
      set({ loading: true });
      await deleteWeekTemplate(id);
      set(state => ({
        weekTemplates: state.weekTemplates.filter(t => t.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting week template:', error);
      set({ loading: false });
    }
  },

  // Workout category actions
  fetchWorkoutCategories: async () => {
    try {
      set({ loading: true });
      const workoutCategories = await fetchWorkoutCategories();
      set({ workoutCategories, loading: false });
    } catch (error) {
      console.error('Error fetching workout categories:', error);
      set({ loading: false });
    }
  },

  addWorkoutCategory: async (categoryData) => {
    try {
      set({ loading: true });
      const id = await createWorkoutCategory(categoryData);
      const newCategory: WorkoutCategory = {
        ...categoryData,
        id,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        createdBy: 'current-user'
      };
      set(state => ({
        workoutCategories: [...state.workoutCategories, newCategory],
        loading: false
      }));
    } catch (error) {
      console.error('Error adding workout category:', error);
      set({ loading: false });
    }
  },

  updateWorkoutCategory: async (id, updates) => {
    try {
      set({ loading: true });
      await updateWorkoutCategory(id, updates);
      set(state => ({
        workoutCategories: state.workoutCategories.map(c =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date() as any } : c
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating workout category:', error);
      set({ loading: false });
    }
  },

  deleteWorkoutCategory: async (id) => {
    try {
      set({ loading: true });
      await deleteWorkoutCategory(id);
      set(state => ({
        workoutCategories: state.workoutCategories.filter(c => c.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting workout category:', error);
      set({ loading: false });
    }
  },

  // Workout type actions
  fetchWorkoutTypes: async () => {
    try {
      set({ loading: true });
      const workoutTypes = await fetchWorkoutTypes();
      set({ workoutTypes, loading: false });
    } catch (error) {
      console.error('Error fetching workout types:', error);
      set({ loading: false });
    }
  },

  addWorkoutType: async (workoutTypeData) => {
    try {
      set({ loading: true });
      const id = await createWorkoutType(workoutTypeData);
      const newWorkoutType: WorkoutType = {
        ...workoutTypeData,
        id,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        createdBy: 'current-user'
      };
      set(state => ({
        workoutTypes: [...state.workoutTypes, newWorkoutType],
        loading: false
      }));
    } catch (error) {
      console.error('Error adding workout type:', error);
      set({ loading: false });
    }
  },

  updateWorkoutType: async (id, updates) => {
    try {
      set({ loading: true });
      await updateWorkoutType(id, updates);
      set(state => ({
        workoutTypes: state.workoutTypes.map(w =>
          w.id === id ? { ...w, ...updates, updatedAt: new Date() as any } : w
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating workout type:', error);
      set({ loading: false });
    }
  },

  deleteWorkoutType: async (id) => {
    try {
      set({ loading: true });
      await deleteWorkoutType(id);
      set(state => ({
        workoutTypes: state.workoutTypes.filter(w => w.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting workout type:', error);
      set({ loading: false });
    }
  },

  // Workout structure template actions
  fetchWorkoutStructureTemplates: async () => {
    try {
      set({ loading: true });
      const templates = await fetchWorkoutStructureTemplates();
      set({ workoutStructureTemplates: templates, loading: false });
    } catch (error) {
      console.error('Error fetching workout structure templates:', error);
      set({ loading: false });
    }
  },

  addWorkoutStructureTemplate: async (templateData) => {
    try {
      set({ loading: true });
      const id = await createWorkoutStructureTemplate(templateData);
      const newTemplate: WorkoutStructureTemplate = {
        ...templateData,
        id,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        createdBy: 'current-user'
      };
      set(state => ({
        workoutStructureTemplates: [...state.workoutStructureTemplates, newTemplate],
        loading: false
      }));
    } catch (error) {
      console.error('Error adding workout structure template:', error);
      set({ loading: false });
    }
  },

  updateWorkoutStructureTemplate: async (id, updates) => {
    try {
      set({ loading: true });
      await updateWorkoutStructureTemplate(id, updates);
      set(state => ({
        workoutStructureTemplates: state.workoutStructureTemplates.map(t =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date() as any } : t
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating workout structure template:', error);
      set({ loading: false });
    }
  },

  deleteWorkoutStructureTemplate: async (id) => {
    try {
      set({ loading: true });
      await deleteWorkoutStructureTemplate(id);
      set(state => ({
        workoutStructureTemplates: state.workoutStructureTemplates.filter(t => t.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting workout structure template:', error);
      set({ loading: false });
    }
  },

  // Full Workout Template Actions
  fetchFullWorkoutTemplates: async () => {
    try {
      set({ loading: true });
      const templates = await getAllWorkoutTemplates();
      set({ workoutTemplates: templates, loading: false });
    } catch (error) {
      console.error('Error fetching workout templates:', error);
      set({ loading: false });
    }
  },

  addFullWorkoutTemplate: async (templateData) => {
    try {
      set({ loading: true });
      const id = await createWorkoutTemplate(templateData);
      // We need to fetch again or construct the object. 
      // Since createWorkoutTemplate only returns ID and we don't have the full object with timestamps from DB easily without fetching or mocking:
      // We'll mock the timestamp for local update
      const newTemplate: WorkoutTemplate = {
        ...templateData,
        id,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };
      set(state => ({
        workoutTemplates: [...state.workoutTemplates, newTemplate],
        loading: false
      }));
    } catch (error) {
      console.error('Error adding workout template:', error);
      set({ loading: false });
    }
  },

  updateFullWorkoutTemplate: async (id, updates) => {
    try {
      set({ loading: true });
      await updateWorkoutTemplate(id, updates);
      set(state => ({
        workoutTemplates: state.workoutTemplates.map(t =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date() as any } : t
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating workout template:', error);
      set({ loading: false });
    }
  },

  deleteFullWorkoutTemplate: async (id) => {
    try {
      set({ loading: true });
      await deleteWorkoutTemplate(id);
      set(state => ({
        workoutTemplates: state.workoutTemplates.filter(t => t.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting workout template:', error);
      set({ loading: false });
    }
  },

  // Business hours actions
  fetchBusinessHours: async () => {
    try {
      const hours = await getBusinessHours();
      set({ businessHours: hours });
    } catch (error) {
      console.error('Error fetching business hours:', error);
      // Use defaults if fetch fails
      set({
        businessHours: {
          daysOfWeek: [1, 2, 3, 4, 5],
          dayHours: {
            1: { startHour: 7, endHour: 20 },
            2: { startHour: 7, endHour: 20 },
            3: { startHour: 7, endHour: 20 },
            4: { startHour: 7, endHour: 20 },
            5: { startHour: 7, endHour: 20 }
          }
        }
      });
    }
  },

  updateBusinessHours: async (hours) => {
    try {
      await updateBusinessHoursInFirebase(hours);
      set({ businessHours: hours });
    } catch (error) {
      console.error('Error updating business hours:', error);
      throw error;
    }
  },

  // Bulk fetch
  fetchAll: async () => {
    const { fetchPeriods, fetchWeekTemplates, fetchWorkoutCategories, fetchWorkoutTypes, fetchWorkoutStructureTemplates, fetchBusinessHours } = get();
    await Promise.all([
      fetchPeriods(),
      fetchWeekTemplates(),
      fetchWorkoutCategories(),
      fetchWorkoutTypes(),
      fetchWorkoutStructureTemplates(),
      get().fetchFullWorkoutTemplates(), // Add this
      fetchBusinessHours()
    ]);
  }
}));

