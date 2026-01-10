import { create } from 'zustand';
import { WorkoutTemplate, WorkoutRound, WorkoutExercise } from '@/lib/types';
import { 
  getAllWorkoutTemplates,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
  duplicateWorkoutTemplate,
  searchWorkoutTemplates,
  getDefaultRounds,
  validateWorkoutTemplate,
  subscribeToWorkoutTemplates
} from '@/lib/firebase/services/workouts';

interface WorkoutStore {
  // State
  workoutTemplates: WorkoutTemplate[];
  currentTemplate: WorkoutTemplate | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  
  // Workout Builder State
  builderTemplate: WorkoutTemplate | null;
  isBuilderMode: boolean;
  
  // Actions
  fetchWorkoutTemplates: () => Promise<void>;
  addWorkoutTemplate: (template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editWorkoutTemplate: (id: string, updates: Partial<Omit<WorkoutTemplate, 'id' | 'createdAt'>>) => Promise<void>;
  removeWorkoutTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (templateId: string, newName: string, createdBy: string) => Promise<string>;
  searchTemplates: (term: string) => Promise<void>;
  setCurrentTemplate: (template: WorkoutTemplate | null) => void;
  setSearchTerm: (term: string) => void;
  clearError: () => void;
  
  // Workout Builder Actions
  startBuilder: (template?: WorkoutTemplate) => void;
  exitBuilder: () => void;
  updateBuilderTemplate: (template: WorkoutTemplate) => void;
  saveBuilderTemplate: () => Promise<string | null>;
  
  // Round Management
  addRound: (round: Omit<WorkoutRound, 'orderIndex'>) => void;
  updateRound: (roundIndex: number, round: Partial<WorkoutRound>) => void;
  removeRound: (roundIndex: number) => void;
  reorderRounds: (fromIndex: number, toIndex: number) => void;
  
  // Exercise Management
  addExercise: (roundIndex: number, exercise: WorkoutExercise) => void;
  updateExercise: (roundIndex: number, exerciseIndex: number, exercise: Partial<WorkoutExercise>) => void;
  removeExercise: (roundIndex: number, exerciseIndex: number) => void;
  reorderExercises: (roundIndex: number, fromIndex: number, toIndex: number) => void;
  
  // Real-time subscription
  subscribeToWorkoutTemplates: (createdBy?: string) => () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  // Initial State
  workoutTemplates: [],
  currentTemplate: null,
  loading: false,
  error: null,
  searchTerm: '',
  builderTemplate: null,
  isBuilderMode: false,

  // Actions
  fetchWorkoutTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await getAllWorkoutTemplates();
      set({ workoutTemplates: templates, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch workout templates',
        loading: false 
      });
    }
  },

  addWorkoutTemplate: async (templateData) => {
    set({ loading: true, error: null });
    try {
      // Validate template before saving
      const errors = validateWorkoutTemplate(templateData);
      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }

      const id = await createWorkoutTemplate(templateData);
      
      // Refresh templates list
      await get().fetchWorkoutTemplates();
      
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add workout template',
        loading: false 
      });
      throw error;
    }
  },

  editWorkoutTemplate: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await updateWorkoutTemplate(id, updates);
      
      // Update local state
      const { workoutTemplates, currentTemplate, builderTemplate } = get();
      const updatedTemplates = workoutTemplates.map(template => 
        template.id === id ? { ...template, ...updates } : template
      );
      
      // Update current template if it's the one being edited
      const updatedCurrentTemplate = currentTemplate?.id === id 
        ? { ...currentTemplate, ...updates } 
        : currentTemplate;
      
      // Update builder template if it's the one being edited
      const updatedBuilderTemplate = builderTemplate?.id === id 
        ? { ...builderTemplate, ...updates } 
        : builderTemplate;
      
      set({ 
        workoutTemplates: updatedTemplates, 
        currentTemplate: updatedCurrentTemplate,
        builderTemplate: updatedBuilderTemplate,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update workout template',
        loading: false 
      });
      throw error;
    }
  },

  removeWorkoutTemplate: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteWorkoutTemplate(id);
      
      // Remove from local state
      const { workoutTemplates, currentTemplate, builderTemplate } = get();
      const filteredTemplates = workoutTemplates.filter(template => template.id !== id);
      
      // Clear current template if it's the one being deleted
      const updatedCurrentTemplate = currentTemplate?.id === id ? null : currentTemplate;
      
      // Clear builder template if it's the one being deleted
      const updatedBuilderTemplate = builderTemplate?.id === id ? null : builderTemplate;
      
      set({ 
        workoutTemplates: filteredTemplates,
        currentTemplate: updatedCurrentTemplate,
        builderTemplate: updatedBuilderTemplate,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete workout template',
        loading: false 
      });
      throw error;
    }
  },

  duplicateTemplate: async (templateId, newName, createdBy) => {
    set({ loading: true, error: null });
    try {
      const id = await duplicateWorkoutTemplate(templateId, newName, createdBy);
      
      // Refresh templates list
      await get().fetchWorkoutTemplates();
      
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to duplicate workout template',
        loading: false 
      });
      throw error;
    }
  },

  searchTemplates: async (term) => {
    set({ loading: true, error: null, searchTerm: term });
    try {
      if (term.trim() === '') {
        await get().fetchWorkoutTemplates();
      } else {
        const templates = await searchWorkoutTemplates(term);
        set({ workoutTemplates: templates, loading: false });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to search workout templates',
        loading: false 
      });
    }
  },

  setCurrentTemplate: (template) => {
    set({ currentTemplate: template });
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  clearError: () => {
    set({ error: null });
  },

  // Workout Builder Actions
  startBuilder: (template) => {
    if (template) {
      set({ 
        builderTemplate: { ...template },
        isBuilderMode: true 
      });
    } else {
      // Create new template with default rounds
      const newTemplate: WorkoutTemplate = {
        id: 'new',
        name: '',
        createdBy: 'current-user', // This should come from auth
        type: 'workout',
        isPublic: false,
        rounds: getDefaultRounds(),
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };
      
      set({ 
        builderTemplate: newTemplate,
        isBuilderMode: true 
      });
    }
  },

  exitBuilder: () => {
    set({ 
      builderTemplate: null,
      isBuilderMode: false 
    });
  },

  updateBuilderTemplate: (template) => {
    set({ builderTemplate: template });
  },

  saveBuilderTemplate: async () => {
    const { builderTemplate } = get();
    if (!builderTemplate) return null;

    try {
      if (builderTemplate.id === 'new') {
        // Create new template
        const { id, createdAt, updatedAt, ...templateData } = builderTemplate;
        const newId = await get().addWorkoutTemplate(templateData);
        
        // Update builder template with new ID
        set({ 
          builderTemplate: { ...builderTemplate, id: newId }
        });
        
        return newId;
      } else {
        // Update existing template
        const { id, createdAt, ...updates } = builderTemplate;
        await get().editWorkoutTemplate(id, updates);
        return id;
      }
    } catch (error) {
      throw error;
    }
  },

  // Round Management
  addRound: (round) => {
    const { builderTemplate } = get();
    if (!builderTemplate) return;

    const newRound: WorkoutRound = {
      ...round,
      orderIndex: builderTemplate.rounds.length,
    };

    const updatedTemplate = {
      ...builderTemplate,
      rounds: [...builderTemplate.rounds, newRound],
    };

    set({ builderTemplate: updatedTemplate });
  },

  updateRound: (roundIndex, roundUpdates) => {
    const { builderTemplate } = get();
    if (!builderTemplate || roundIndex >= builderTemplate.rounds.length) return;

    const updatedRounds = builderTemplate.rounds.map((round, index) =>
      index === roundIndex ? { ...round, ...roundUpdates } : round
    );

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  removeRound: (roundIndex) => {
    const { builderTemplate } = get();
    if (!builderTemplate || roundIndex >= builderTemplate.rounds.length) return;

    const updatedRounds = builderTemplate.rounds
      .filter((_, index) => index !== roundIndex)
      .map((round, index) => ({ ...round, orderIndex: index }));

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  reorderRounds: (fromIndex, toIndex) => {
    const { builderTemplate } = get();
    if (!builderTemplate) return;

    const rounds = [...builderTemplate.rounds];
    const [movedRound] = rounds.splice(fromIndex, 1);
    rounds.splice(toIndex, 0, movedRound);

    // Update order indices
    const updatedRounds = rounds.map((round, index) => ({
      ...round,
      orderIndex: index,
    }));

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  // Exercise Management
  addExercise: (roundIndex, exercise) => {
    const { builderTemplate } = get();
    if (!builderTemplate || roundIndex >= builderTemplate.rounds.length) return;

    const updatedRounds = builderTemplate.rounds.map((round, index) => {
      if (index === roundIndex) {
        return {
          ...round,
          exercises: [...round.exercises, exercise],
        };
      }
      return round;
    });

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  updateExercise: (roundIndex, exerciseIndex, exerciseUpdates) => {
    const { builderTemplate } = get();
    if (!builderTemplate || roundIndex >= builderTemplate.rounds.length) return;

    const updatedRounds = builderTemplate.rounds.map((round, rIndex) => {
      if (rIndex === roundIndex) {
        const updatedExercises = round.exercises.map((exercise, eIndex) =>
          eIndex === exerciseIndex ? { ...exercise, ...exerciseUpdates } : exercise
        );
        return { ...round, exercises: updatedExercises };
      }
      return round;
    });

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  removeExercise: (roundIndex, exerciseIndex) => {
    const { builderTemplate } = get();
    if (!builderTemplate || roundIndex >= builderTemplate.rounds.length) return;

    const updatedRounds = builderTemplate.rounds.map((round, rIndex) => {
      if (rIndex === roundIndex) {
        const updatedExercises = round.exercises.filter((_, eIndex) => eIndex !== exerciseIndex);
        return { ...round, exercises: updatedExercises };
      }
      return round;
    });

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  reorderExercises: (roundIndex, fromIndex, toIndex) => {
    const { builderTemplate } = get();
    if (!builderTemplate || roundIndex >= builderTemplate.rounds.length) return;

    const updatedRounds = builderTemplate.rounds.map((round, rIndex) => {
      if (rIndex === roundIndex) {
        const exercises = [...round.exercises];
        const [movedExercise] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, movedExercise);
        return { ...round, exercises };
      }
      return round;
    });

    const updatedTemplate = {
      ...builderTemplate,
      rounds: updatedRounds,
    };

    set({ builderTemplate: updatedTemplate });
  },

  subscribeToWorkoutTemplates: (createdBy) => {
    return subscribeToWorkoutTemplates((templates) => {
      set({ workoutTemplates: templates });
    }, createdBy);
  },
}));
