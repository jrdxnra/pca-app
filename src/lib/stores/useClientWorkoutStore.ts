import { create } from 'zustand';
import type { ClientWorkout, WorkoutTemplate } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import * as clientWorkoutService from '@/lib/firebase/services/clientWorkouts';
import * as workoutService from '@/lib/firebase/services/workouts';

interface ClientWorkoutStore {
  workouts: ClientWorkout[];
  currentWorkout: ClientWorkout | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchWorkoutsByClient: (clientId: string) => Promise<void>;
  fetchWorkoutsByPeriod: (periodId: string) => Promise<void>;
  fetchWorkoutsByDateRange: (clientId: string, startDate: Timestamp, endDate: Timestamp) => Promise<void>;
  getWorkout: (id: string) => Promise<ClientWorkout | null>;
  createWorkout: (workout: Omit<ClientWorkout, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ClientWorkout>;
  createWorkoutFromTemplate: (
    clientId: string,
    periodId: string,
    date: Timestamp,
    dayOfWeek: number,
    categoryName: string,
    templateId: string,
    createdBy: string
  ) => Promise<ClientWorkout>;
  updateWorkout: (id: string, updates: Partial<ClientWorkout>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  copyTemplateToWorkout: (workoutId: string, templateId: string) => Promise<void>;
  getWorkoutData: (workout: ClientWorkout) => Promise<{
    title: string;
    notes?: string;
    time?: string;
    warmups: any[];
    rounds: any[];
  }>;
  setCurrentWorkout: (workout: ClientWorkout | null) => void;
  clearWorkouts: () => void;
}

export const useClientWorkoutStore = create<ClientWorkoutStore>((set, get) => ({
  workouts: [],
  currentWorkout: null,
  isLoading: false,
  error: null,

  fetchWorkoutsByClient: async (clientId: string) => {
    set({ isLoading: true, error: null });
    try {
      const workouts = await clientWorkoutService.fetchClientWorkouts(clientId);
      set({ workouts, isLoading: false });
    } catch (error) {
      console.error('Error fetching client workouts:', error);
      set({ error: 'Failed to fetch workouts', isLoading: false });
    }
  },

  fetchWorkoutsByPeriod: async (periodId: string) => {
    set({ isLoading: true, error: null });
    try {
      const workouts = await clientWorkoutService.fetchPeriodWorkouts(periodId);
      set({ workouts, isLoading: false });
    } catch (error) {
      console.error('Error fetching period workouts:', error);
      set({ error: 'Failed to fetch workouts', isLoading: false });
    }
  },

  fetchWorkoutsByDateRange: async (clientId: string, startDate: Timestamp, endDate: Timestamp) => {
    set({ isLoading: true, error: null });
    try {
      const workouts = await clientWorkoutService.fetchWorkoutsByDateRange(clientId, startDate, endDate);
      set({ workouts, isLoading: false });
    } catch (error) {
      console.error('Error fetching workouts by date range:', error);
      set({ error: 'Failed to fetch workouts', isLoading: false });
    }
  },

  getWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workout = await clientWorkoutService.getClientWorkout(id);
      set({ currentWorkout: workout, isLoading: false });
      return workout;
    } catch (error) {
      console.error('Error fetching workout:', error);
      set({ error: 'Failed to fetch workout', isLoading: false });
      return null;
    }
  },

  createWorkout: async (workout) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkout = await clientWorkoutService.createClientWorkout(workout);
      set(state => ({
        workouts: [...state.workouts, newWorkout],
        isLoading: false,
      }));
      return newWorkout;
    } catch (error) {
      console.error('Error creating workout:', error);
      set({ error: 'Failed to create workout', isLoading: false });
      throw error;
    }
  },

  createWorkoutFromTemplate: async (
    clientId,
    periodId,
    date,
    dayOfWeek,
    categoryName,
    templateId,
    createdBy
  ) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkout = await clientWorkoutService.createClientWorkoutFromTemplate(
        clientId,
        periodId,
        date,
        dayOfWeek,
        categoryName,
        templateId,
        createdBy
      );
      set(state => ({
        workouts: [...state.workouts, newWorkout],
        isLoading: false,
      }));
      return newWorkout;
    } catch (error) {
      console.error('Error creating workout from template:', error);
      set({ error: 'Failed to create workout from template', isLoading: false });
      throw error;
    }
  },

  updateWorkout: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      await clientWorkoutService.updateClientWorkout(id, updates);
      set(state => ({
        workouts: state.workouts.map(w => w.id === id ? { ...w, ...updates } : w),
        currentWorkout: state.currentWorkout?.id === id 
          ? { ...state.currentWorkout, ...updates } 
          : state.currentWorkout,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error updating workout:', error);
      set({ error: 'Failed to update workout', isLoading: false });
      throw error;
    }
  },

  deleteWorkout: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await clientWorkoutService.deleteClientWorkout(id);
      set(state => ({
        workouts: state.workouts.filter(w => w.id !== id),
        currentWorkout: state.currentWorkout?.id === id ? null : state.currentWorkout,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error deleting workout:', error);
      set({ error: 'Failed to delete workout', isLoading: false });
      throw error;
    }
  },

  copyTemplateToWorkout: async (workoutId, templateId) => {
    set({ isLoading: true, error: null });
    try {
      const template = await workoutService.getWorkoutTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      
      await clientWorkoutService.copyTemplateToClientWorkout(workoutId, template as WorkoutTemplate);
      
      // Refresh the workout
      const updatedWorkout = await clientWorkoutService.getClientWorkout(workoutId);
      if (updatedWorkout) {
        set(state => ({
          workouts: state.workouts.map(w => w.id === workoutId ? updatedWorkout : w),
          currentWorkout: state.currentWorkout?.id === workoutId ? updatedWorkout : state.currentWorkout,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Error copying template to workout:', error);
      set({ error: 'Failed to copy template', isLoading: false });
      throw error;
    }
  },

  getWorkoutData: async (workout) => {
    try {
      const getTemplate = async (id: string) => {
        const template = await workoutService.getWorkoutTemplate(id);
        return template;
      };
      
      return await clientWorkoutService.getWorkoutData(workout, getTemplate);
    } catch (error) {
      console.error('Error getting workout data:', error);
      return {
        title: 'Error Loading Workout',
        warmups: [],
        rounds: [],
      };
    }
  },

  setCurrentWorkout: (workout) => {
    set({ currentWorkout: workout });
  },

  clearWorkouts: () => {
    set({ workouts: [], currentWorkout: null, error: null });
  },
}));

