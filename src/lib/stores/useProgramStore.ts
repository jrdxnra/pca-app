import { create } from 'zustand';
import { Program, ScheduledWorkout } from '@/lib/types';
import { 
  getAllPrograms,
  createProgram,
  updateProgram as updateProgramService,
  deleteProgram,
  getProgramsByClient,
  getScheduledWorkoutsByProgram,
  getScheduledWorkoutsByClient,
  getAllScheduledWorkouts,
  getScheduledWorkoutsByDateRange,
  createScheduledWorkout,
  updateScheduledWorkout,
  deleteScheduledWorkout,
  scheduleWorkoutFromTemplate,
  duplicateWeek,
  subscribeToPrograms,
  subscribeToScheduledWorkouts,
  calculateWeekNumber,
  getWeekStartDate,
  getWeekEndDate
} from '@/lib/firebase/services/programs';

// Cache duration in milliseconds (30 seconds)
const CACHE_DURATION = 30 * 1000;

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

interface ProgramStore {
  // State
  programs: Program[];
  scheduledWorkouts: ScheduledWorkout[];
  currentProgram: Program | null;
  selectedClient: string | null;
  currentDate: Date;
  viewMode: 'month' | 'week' | 'day';
  loading: boolean;
  error: string | null;
  
  // Calendar State
  calendarDate: Date;
  selectedDate: Date | null;
  
  // Cache tracking
  _programsFetchTime: number | null;
  _workoutsFetchTime: number | null;
  _workoutsFetchKey: string | null; // Track what was fetched (programId, clientId, etc)
  
  // Actions
  fetchPrograms: (force?: boolean) => Promise<void>;
  fetchProgramsByClient: (clientId: string, force?: boolean) => Promise<void>;
  fetchScheduledWorkouts: (programId: string, force?: boolean) => Promise<void>;
  fetchScheduledWorkoutsByClient: (clientId: string, force?: boolean) => Promise<void>;
  fetchAllScheduledWorkouts: (force?: boolean) => Promise<void>;
  fetchScheduledWorkoutsByDateRange: (clientId: string, startDate: Date, endDate: Date, force?: boolean) => Promise<void>;
  
  addProgram: (program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editProgram: (id: string, updates: Partial<Omit<Program, 'id' | 'createdAt'>>) => Promise<void>;
  updateProgram: (program: Program) => Promise<void>;
  removeProgram: (id: string) => Promise<void>;
  
  addScheduledWorkout: (workout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editScheduledWorkout: (id: string, updates: Partial<Omit<ScheduledWorkout, 'id' | 'createdAt'>>) => Promise<void>;
  removeScheduledWorkout: (id: string) => Promise<void>;
  
  scheduleWorkout: (
    programId: string,
    clientId: string,
    date: Date,
    workoutTemplateId: string,
    sessionType: string,
    keepLinked?: boolean
  ) => Promise<string>;
  
  duplicateWeek: (
    programId: string,
    clientId: string,
    sourceWeekStart: Date,
    targetWeekStart: Date
  ) => Promise<void>;
  
  // State Management
  setCurrentProgram: (program: Program | null) => void;
  setSelectedClient: (clientId: string | null) => void;
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: 'month' | 'week' | 'day') => void;
  setCalendarDate: (date: Date) => void;
  setSelectedDate: (date: Date | null) => void;
  clearError: () => void;
  initializeSelectedClient: () => void;
  
  // Calendar Navigation
  navigateMonth: (direction: number) => void;
  navigateWeek: (direction: number) => void;
  navigateDay: (direction: number) => void;
  goToToday: () => void;
  
  // Utility Functions
  getWorkoutsForDate: (date: Date) => ScheduledWorkout[];
  getWorkoutsForWeek: (weekStart: Date) => ScheduledWorkout[];
  getWorkoutsForMonth: (month: number, year: number) => ScheduledWorkout[];
  
  // Real-time subscriptions
  subscribeToPrograms: () => () => void;
  subscribeToScheduledWorkouts: (programId: string) => () => void;
}

// Initialize calendarDate from localStorage if available
const getInitialCalendarDate = (): Date => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('calendarDate');
    if (saved) {
      try {
        const parsed = new Date(saved);
        if (isValidDate(parsed)) return parsed;
        console.warn('Invalid saved calendarDate, resetting:', saved);
        localStorage.removeItem('calendarDate');
      } catch (e) {
        console.warn('Failed to parse saved calendarDate:', e);
        localStorage.removeItem('calendarDate');
      }
    }
  }
  return new Date();
};

export const useProgramStore = create<ProgramStore>((set, get) => ({
  // Initial State
  programs: [],
  scheduledWorkouts: [],
  currentProgram: null,
  selectedClient: null, // Always start with null to avoid hydration mismatch
  currentDate: new Date(),
  viewMode: 'month',
  loading: false,
  error: null,
  calendarDate: getInitialCalendarDate(),
  selectedDate: null,
  _programsFetchTime: null,
  _workoutsFetchTime: null,
  _workoutsFetchKey: null,

  // Actions
  fetchPrograms: async (force = false) => {
    const { _programsFetchTime, programs } = get();
    
    // Skip if cache is fresh (unless forced)
    if (!force && programs.length > 0 && _programsFetchTime && Date.now() - _programsFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const fetchedPrograms = await getAllPrograms();
      set({ programs: fetchedPrograms, loading: false, _programsFetchTime: Date.now() });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch programs',
        loading: false 
      });
    }
  },

  fetchProgramsByClient: async (clientId, force = false) => {
    const { _programsFetchTime, programs, _workoutsFetchKey } = get();
    const cacheKey = `client:${clientId}`;
    
    // Skip if cache is fresh and for same client (unless forced)
    if (!force && programs.length > 0 && _programsFetchTime && _workoutsFetchKey === cacheKey && Date.now() - _programsFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const fetchedPrograms = await getProgramsByClient(clientId);
      set({ programs: fetchedPrograms, loading: false, _programsFetchTime: Date.now() });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch client programs',
        loading: false 
      });
    }
  },

  fetchScheduledWorkouts: async (programId, force = false) => {
    const { _workoutsFetchTime, scheduledWorkouts, _workoutsFetchKey } = get();
    const cacheKey = `program:${programId}`;
    
    // Skip if cache is fresh and for same program (unless forced)
    if (!force && scheduledWorkouts.length > 0 && _workoutsFetchTime && _workoutsFetchKey === cacheKey && Date.now() - _workoutsFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const workouts = await getScheduledWorkoutsByProgram(programId);
      set({ scheduledWorkouts: workouts, loading: false, _workoutsFetchTime: Date.now(), _workoutsFetchKey: cacheKey });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch scheduled workouts',
        loading: false 
      });
    }
  },

  fetchScheduledWorkoutsByClient: async (clientId, force = false) => {
    const { _workoutsFetchTime, scheduledWorkouts, _workoutsFetchKey } = get();
    const cacheKey = `client:${clientId}`;
    
    // Skip if cache is fresh and for same client (unless forced)
    if (!force && scheduledWorkouts.length > 0 && _workoutsFetchTime && _workoutsFetchKey === cacheKey && Date.now() - _workoutsFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const workouts = await getScheduledWorkoutsByClient(clientId);
      set({ scheduledWorkouts: workouts, loading: false, _workoutsFetchTime: Date.now(), _workoutsFetchKey: cacheKey });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch client workouts',
        loading: false 
      });
    }
  },

  fetchAllScheduledWorkouts: async (force = false) => {
    const { _workoutsFetchTime, scheduledWorkouts, _workoutsFetchKey } = get();
    const cacheKey = 'all';
    
    // Skip if cache is fresh (unless forced)
    if (!force && scheduledWorkouts.length > 0 && _workoutsFetchTime && _workoutsFetchKey === cacheKey && Date.now() - _workoutsFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const workouts = await getAllScheduledWorkouts();
      set({ scheduledWorkouts: workouts, loading: false, _workoutsFetchTime: Date.now(), _workoutsFetchKey: cacheKey });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch all scheduled workouts',
        loading: false 
      });
    }
  },

  fetchScheduledWorkoutsByDateRange: async (clientId, startDate, endDate, force = false) => {
    const { _workoutsFetchTime, scheduledWorkouts, _workoutsFetchKey } = get();
    const cacheKey = `range:${clientId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    // Skip if cache is fresh and for same range (unless forced)
    if (!force && scheduledWorkouts.length > 0 && _workoutsFetchTime && _workoutsFetchKey === cacheKey && Date.now() - _workoutsFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const workouts = await getScheduledWorkoutsByDateRange(clientId, startDate, endDate);
      set({ scheduledWorkouts: workouts, loading: false, _workoutsFetchTime: Date.now(), _workoutsFetchKey: cacheKey });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch workouts for date range',
        loading: false 
      });
    }
  },

  addProgram: async (programData) => {
    set({ loading: true, error: null });
    try {
      const id = await createProgram(programData);
      await get().fetchPrograms();
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create program',
        loading: false 
      });
      throw error;
    }
  },

  editProgram: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await updateProgramService(id, updates);
      
      // Update local state
      const { programs, currentProgram } = get();
      const updatedPrograms = programs.map(program => 
        program.id === id ? { ...program, ...updates } : program
      );
      
      const updatedCurrentProgram = currentProgram?.id === id 
        ? { ...currentProgram, ...updates } 
        : currentProgram;
      
      set({ 
        programs: updatedPrograms, 
        currentProgram: updatedCurrentProgram,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update program',
        loading: false 
      });
      throw error;
    }
  },

  updateProgram: async (program) => {
    set({ loading: true, error: null });
    try {
      await updateProgramService(program.id, program);
      
      // Update local state
      const { programs, currentProgram } = get();
      const updatedPrograms = programs.map(p => 
        p.id === program.id ? program : p
      );
      
      const updatedCurrentProgram = currentProgram?.id === program.id 
        ? program 
        : currentProgram;
      
      set({ 
        programs: updatedPrograms, 
        currentProgram: updatedCurrentProgram,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update program',
        loading: false 
      });
      throw error;
    }
  },

  removeProgram: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteProgram(id);
      
      const { programs, currentProgram } = get();
      const filteredPrograms = programs.filter(program => program.id !== id);
      const updatedCurrentProgram = currentProgram?.id === id ? null : currentProgram;
      
      set({ 
        programs: filteredPrograms,
        currentProgram: updatedCurrentProgram,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete program',
        loading: false 
      });
      throw error;
    }
  },

  addScheduledWorkout: async (workoutData) => {
    set({ loading: true, error: null });
    try {
      const id = await createScheduledWorkout(workoutData);
      
      // Refresh scheduled workouts
      if (workoutData.programId) {
        await get().fetchScheduledWorkouts(workoutData.programId);
      }
      
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to schedule workout',
        loading: false 
      });
      throw error;
    }
  },

  editScheduledWorkout: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await updateScheduledWorkout(id, updates);
      
      // Update local state
      const { scheduledWorkouts } = get();
      const updatedWorkouts = scheduledWorkouts.map(workout => 
        workout.id === id ? { ...workout, ...updates } : workout
      );
      
      set({ scheduledWorkouts: updatedWorkouts, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update scheduled workout',
        loading: false 
      });
      throw error;
    }
  },

  removeScheduledWorkout: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteScheduledWorkout(id);
      
      const { scheduledWorkouts } = get();
      const filteredWorkouts = scheduledWorkouts.filter(workout => workout.id !== id);
      
      set({ scheduledWorkouts: filteredWorkouts, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete scheduled workout',
        loading: false 
      });
      throw error;
    }
  },

  scheduleWorkout: async (programId, clientId, date, workoutTemplateId, sessionType, keepLinked = true) => {
    set({ loading: true, error: null });
    try {
      const id = await scheduleWorkoutFromTemplate(
        programId,
        clientId,
        date,
        workoutTemplateId,
        sessionType,
        keepLinked
      );
      
      // Refresh scheduled workouts
      await get().fetchScheduledWorkouts(programId);
      
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to schedule workout from template',
        loading: false 
      });
      throw error;
    }
  },

  duplicateWeek: async (programId, clientId, sourceWeekStart, targetWeekStart) => {
    set({ loading: true, error: null });
    try {
      await duplicateWeek(programId, clientId, sourceWeekStart, targetWeekStart);
      
      // Refresh scheduled workouts
      await get().fetchScheduledWorkouts(programId);
      
      set({ loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to duplicate week',
        loading: false 
      });
      throw error;
    }
  },

  // State Management
  setCurrentProgram: (program) => {
    set({ currentProgram: program });
  },

  setSelectedClient: (clientId) => {
    set({ selectedClient: clientId });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (clientId) {
        localStorage.setItem('selectedClient', clientId);
      } else {
        localStorage.removeItem('selectedClient');
      }
    }
  },

  setCurrentDate: (date) => {
    set({ currentDate: date });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setCalendarDate: (date) => {
    set({ calendarDate: date });
    // Persist to localStorage for true state sharing between pages
    if (typeof window !== 'undefined') {
      if (isValidDate(date)) {
        localStorage.setItem('calendarDate', date.toISOString());
      } else {
        console.warn('Refusing to persist invalid calendarDate:', date);
        localStorage.removeItem('calendarDate');
      }
    }
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  clearError: () => {
    set({ error: null });
  },

  initializeSelectedClient: () => {
    if (typeof window !== 'undefined') {
      const savedClient = localStorage.getItem('selectedClient');
      if (savedClient) {
        set({ selectedClient: savedClient });
      }
    }
  },

  // Calendar Navigation
  navigateMonth: (direction) => {
    const { calendarDate } = get();
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + direction);
    set({ calendarDate: newDate });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (isValidDate(newDate)) localStorage.setItem('calendarDate', newDate.toISOString());
    }
  },

  navigateWeek: (direction) => {
    const { calendarDate } = get();
    const newDate = new Date(calendarDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    set({ calendarDate: newDate });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (isValidDate(newDate)) localStorage.setItem('calendarDate', newDate.toISOString());
    }
  },

  navigateDay: (direction) => {
    const { calendarDate } = get();
    const newDate = new Date(calendarDate);
    newDate.setDate(newDate.getDate() + direction);
    set({ calendarDate: newDate });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (isValidDate(newDate)) localStorage.setItem('calendarDate', newDate.toISOString());
    }
  },

  goToToday: () => {
    const today = new Date();
    set({ calendarDate: today, currentDate: today });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendarDate', today.toISOString());
    }
  },

  // Utility Functions
  getWorkoutsForDate: (date) => {
    const { scheduledWorkouts } = get();
    const targetDate = date.toDateString();
    
    return scheduledWorkouts.filter(workout => {
      const workoutDate = workout.date.toDate().toDateString();
      return workoutDate === targetDate;
    });
  },

  getWorkoutsForWeek: (weekStart) => {
    const { scheduledWorkouts } = get();
    const weekEnd = getWeekEndDate(weekStart);
    
    return scheduledWorkouts.filter(workout => {
      const workoutDate = workout.date.toDate();
      return workoutDate >= weekStart && workoutDate <= weekEnd;
    });
  },

  getWorkoutsForMonth: (month, year) => {
    const { scheduledWorkouts } = get();
    
    return scheduledWorkouts.filter(workout => {
      const workoutDate = workout.date.toDate();
      return workoutDate.getMonth() === month && workoutDate.getFullYear() === year;
    });
  },

  // Real-time subscriptions
  subscribeToPrograms: () => {
    return subscribeToPrograms((programs) => {
      set({ programs });
    });
  },

  subscribeToScheduledWorkouts: (programId) => {
    return subscribeToScheduledWorkouts(programId, (workouts) => {
      set({ scheduledWorkouts: workouts });
    });
  },
}));
