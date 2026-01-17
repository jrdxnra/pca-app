import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Program, ScheduledWorkout } from '@/lib/types';
import {
  createProgram,
  updateProgram,
  deleteProgram,
  createScheduledWorkout,
  updateScheduledWorkout,
  deleteScheduledWorkout,
} from '@/lib/firebase/services/programs';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for creating a program
 */
export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (programData: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>) => {
      return await createProgram(programData);
    },
    onMutate: async (newProgram) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.programs.all });
      const previousPrograms = queryClient.getQueryData<Program[]>(queryKeys.programs.list());

      const optimisticProgram: Program = {
        id: `temp-${Date.now()}`,
        ...newProgram,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      queryClient.setQueryData<Program[]>(
        queryKeys.programs.list(),
        (old = []) => [...old, optimisticProgram]
      );

      return { previousPrograms };
    },
    onError: (error, variables, context) => {
      if (context?.previousPrograms) {
        queryClient.setQueryData(queryKeys.programs.list(), context.previousPrograms);
      }
      console.error('Error creating program:', error);
      toastError('Failed to create program. Please try again.');
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      toastSuccess('Program created successfully');
    },
  });
}

/**
 * Hook for updating a program
 */
export function useUpdateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Program, 'id' | 'createdAt'>> }) => {
      return await updateProgram(id, updates);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.programs.all });
      const previousProgram = queryClient.getQueryData<Program>(queryKeys.programs.detail(id));
      const previousPrograms = queryClient.getQueryData<Program[]>(queryKeys.programs.list());

      queryClient.setQueryData<Program>(
        queryKeys.programs.detail(id),
        (old) => (old ? { ...old, ...updates } : old)
      );

      queryClient.setQueryData<Program[]>(
        queryKeys.programs.list(),
        (old = []) => old.map(program => program.id === id ? { ...program, ...updates } : program)
      );

      return { previousProgram, previousPrograms };
    },
    onError: (error, variables, context) => {
      if (context?.previousProgram) {
        queryClient.setQueryData(queryKeys.programs.detail(variables.id), context.previousProgram);
      }
      if (context?.previousPrograms) {
        queryClient.setQueryData(queryKeys.programs.list(), context.previousPrograms);
      }
      console.error('Error updating program:', error);
      toastError('Failed to update program. Please try again.');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      toastSuccess('Program updated successfully');
    },
  });
}

/**
 * Hook for deleting a program
 */
export function useDeleteProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await deleteProgram(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.programs.all });
      const previousPrograms = queryClient.getQueryData<Program[]>(queryKeys.programs.list());

      queryClient.setQueryData<Program[]>(
        queryKeys.programs.list(),
        (old = []) => old.filter(program => program.id !== id)
      );

      return { previousPrograms };
    },
    onError: (error, variables, context) => {
      if (context?.previousPrograms) {
        queryClient.setQueryData(queryKeys.programs.list(), context.previousPrograms);
      }
      console.error('Error deleting program:', error);
      toastError('Failed to delete program. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      toastSuccess('Program deleted successfully');
    },
  });
}

/**
 * Hook for creating a scheduled workout
 */
export function useCreateScheduledWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workoutData: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'>) => {
      return await createScheduledWorkout(workoutData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledWorkouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      toastSuccess('Workout scheduled successfully');
    },
    onError: (error) => {
      console.error('Error creating scheduled workout:', error);
      toastError('Failed to schedule workout. Please try again.');
    },
  });
}

/**
 * Hook for updating a scheduled workout
 */
export function useUpdateScheduledWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<ScheduledWorkout, 'id' | 'createdAt'>> }) => {
      return await updateScheduledWorkout(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledWorkouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      toastSuccess('Scheduled workout updated successfully');
    },
    onError: (error) => {
      console.error('Error updating scheduled workout:', error);
      toastError('Failed to update scheduled workout. Please try again.');
    },
  });
}

/**
 * Hook for deleting a scheduled workout
 */
export function useDeleteScheduledWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await deleteScheduledWorkout(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledWorkouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      toastSuccess('Scheduled workout deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting scheduled workout:', error);
      toastError('Failed to delete scheduled workout. Please try again.');
    },
  });
}
