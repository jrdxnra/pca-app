import { Timestamp } from 'firebase/firestore';

// Core Types
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthday?: string; // Format: YYYY-MM-DD
  notes?: string;
  goals?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  personalRecords: Record<string, PersonalRecord>;
}

export interface PersonalRecord {
  oneRepMax: number;
  date: Timestamp;
  method: 'tested' | 'estimated';
  history: Array<{
    value: number;
    date: Timestamp;
    method: 'tested' | 'estimated';
  }>;
}

export interface MovementCategory {
  id: string;
  name: string;
  color: string; // Hex color code
  defaultConfiguration?: {
    use_reps: boolean;
    use_tempo: boolean;
    use_time: boolean;
    use_weight: boolean;
    weight_measure: 'lbs' | 'kg';
    use_distance: boolean;
    distance_measure: 'mi' | 'km' | 'm' | 'yd' | 'ft';
    use_pace: boolean;
    pace_measure: 'mi' | 'km';
    unilateral: boolean;
    use_percentage: boolean;
    use_rpe: boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Movement {
  id: string;
  name: string;
  categoryId: string;
  category?: MovementCategory; // Populated when needed
  ordinal: number; // For ordering within category
  configuration: {
    use_reps: boolean;
    use_tempo: boolean;
    use_time: boolean;
    use_weight: boolean;
    weight_measure: 'lbs' | 'kg';
    use_distance: boolean;
    distance_measure: 'mi' | 'km' | 'm' | 'yd' | 'ft';
    use_pace: boolean;
    pace_measure: 'mi' | 'km';
    unilateral: boolean;
    use_percentage: boolean;
    use_rpe: boolean;
  };
  instructions?: string;
  links: string[]; // Video URLs or other resources
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkoutExercise {
  movementId: string;
  sets: number;
  reps: string; // e.g., "10", "8-12", "AMRAP"
  weight?: string; // e.g., "135", "185 lbs"
  targetRPE?: number;
  percentageIncrease?: string; // e.g., "+5%"
  tempo?: string; // e.g., "3010"
  rest?: string; // e.g., "60s", "2min"
  notes?: string;
}

export interface WorkoutRound {
  name: string; // e.g., "PP/MB/Ballistics", "Strength 1"
  orderIndex: number;
  exercises: WorkoutExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  createdBy: string; // coach ID
  type: 'workout' | 'week' | 'program';
  isPublic: boolean;
  rounds: WorkoutRound[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Coachella-style Program Structure
export interface Program {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  totalWeeks?: number;
  isTemplate: boolean; // true = reusable template, false = specific program
  createdBy: string; // coach ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  weeks?: ProgramWeek[]; // Array of weeks in the program (optional for backward compatibility)
  periodization?: Array<{
    weekStart: number;
    weekEnd: number;
    focus: string;
    color: string;
  }>;
}

export interface ProgramWeek {
  id: string;
  programId: string;
  ordinal: number; // Week number (1, 2, 3, etc.)
  notes?: string;
  workouts: ProgramWorkout[]; // Array of workouts in this week
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProgramWorkout {
  id: string;
  weekId: string;
  ordinal: number; // Workout number within the week (1, 2, 3, etc.)
  title?: string; // e.g., "Upper Strength", "Lower Power"
  notes?: string;
  date?: Timestamp; // Optional specific date
  time?: string; // Optional specific time
  rounds: ProgramRound[]; // Array of rounds in this workout
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProgramRound {
  id: string;
  workoutId: string;
  ordinal: number; // Round number within the workout (1, 2, 3, etc.)
  sets: number; // Number of sets for this round
  movementUsages: ProgramMovementUsage[]; // Array of movements in this round
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProgramMovementUsage {
  id: string;
  roundId: string;
  movementId: string;
  movement?: Movement; // Populated when needed
  ordinal: number; // Order within the round
  note?: string;
  targetWorkload: ProgramTargetWorkload; // The specific parameters for this movement
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProgramTargetWorkload {
  id: string;
  movementUsageId: string;
  useWeight: boolean;
  weight?: string;
  weightMeasure: 'lbs' | 'kg';
  useReps: boolean;
  reps?: string; // e.g., "8-12", "5x5", "AMRAP"
  useTempo: boolean;
  tempo?: string; // e.g., "3-1-1-0"
  useTime: boolean;
  time?: string; // e.g., "30 seconds", "2 minutes"
  useDistance: boolean;
  distance?: number;
  distanceMeasure: 'mi' | 'km' | 'm' | 'yd' | 'ft';
  usePace: boolean;
  pace?: number;
  paceMeasure: 'mi' | 'km';
  usePercentage: boolean;
  percentage?: number; // Percentage of 1RM
  useRPE: boolean;
  rpe?: string; // e.g., "7", "8-9"
  unilateral: boolean; // Single arm/leg
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProgramAssignment {
  id: string;
  programId: string; // References the Program template
  clientId: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ScheduledWorkout {
  id: string;
  programId: string;
  clientId: string;
  date: Timestamp;
  weekNumber: number;
  dayNumber: number;
  workoutTemplateId?: string;
  isTemplate: boolean; // true = linked to template, false = independent
  sessionType: string; // e.g., "Upper Strength"
  duration: number; // duration in minutes (30, 60, 90, etc.)
  rounds: WorkoutRound[];
  status: 'scheduled' | 'completed' | 'skipped';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Client Program with Period and Template Assignment
export interface ClientProgram {
  id: string;
  clientId: string;
  programTemplateId?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  periods: ClientProgramPeriod[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface ClientProgramPeriod {
  id: string;
  periodConfigId: string; // References period from configuration
  periodName: string;
  periodColor: string;
  startDate: Timestamp;
  endDate: Timestamp;
  weekTemplateId?: string; // References week template from configuration
  days: ClientProgramDay[];
}

export interface ClientProgramDay {
  date: Timestamp;
  workoutCategory: string; // e.g., "Workout", "Rest Day", "Cardio Day"
  workoutCategoryColor: string;
  workoutTypeId?: string; // Optional reference to specific workout type (PP, MB, etc.)
  time?: string; // Time in HH:MM format (e.g., "09:00")
  isAllDay?: boolean; // Whether this is an all-day event
}

// Client Workout - Hybrid approach (can reference template OR have embedded data)
export interface ClientWorkout {
  id: string;
  clientId: string;
  programId?: string; // Optional link to program template
  periodId: string; // Links to ClientProgramPeriod
  date: Timestamp; // Specific date (e.g., Oct 14, 2025)
  dayOfWeek: number; // 0=Mon, 1=Tue... 6=Sun
  categoryName: string; // "STRENGTH", "CARDIO", etc. from ClientProgramDay
  
  // NEW: Track which template structure is applied
  appliedTemplateId?: string; // Links to WorkoutStructureTemplate
  
  // HYBRID APPROACH
  workoutTemplateId?: string; // Link to WorkoutTemplate (if using template)
  isModified: boolean; // false = use template data, true = use embedded data
  
  // Embedded workout data (only populated if isModified = true OR no template)
  title?: string;
  notes?: string;
  time?: string; // HH:MM format
  warmups?: ClientWorkoutWarmup[];
  rounds?: ClientWorkoutRound[];
  
  // Column visibility settings for workout builder
  visibleColumns?: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface ClientWorkoutWarmup {
  ordinal: number;
  text: string;
}

export interface ClientWorkoutRound {
  ordinal: number;
  sets: number;
  
  // NEW: From workout structure template section
  sectionName?: string; // e.g., "PP/MB/BALLISTICS", "STRENGTH1"
  sectionColor?: string; // From workout type color
  workoutTypeId?: string; // Reference to workout type
  
  movementUsages: ClientWorkoutMovementUsage[];
}

export interface ClientWorkoutMovementUsage {
  ordinal: number;
  movementId: string;
  categoryId: string;
  note?: string;
  targetWorkload: ClientWorkoutTargetWorkload;
}

export interface ClientWorkoutTargetWorkload {
  useWeight: boolean;
  weight?: string;
  weightMeasure: 'lbs' | 'kg';
  useReps: boolean;
  reps?: string; // e.g., "8-12", "5x5", "AMRAP"
  useTempo: boolean;
  tempo?: string; // e.g., "3010", "3-1-1-0"
  useTime: boolean;
  time?: string; // e.g., "30 seconds", "2 minutes"
  useDistance: boolean;
  distance?: number;
  distanceMeasure: 'mi' | 'km' | 'm' | 'yd' | 'ft';
  usePace: boolean;
  pace?: number;
  paceMeasure: 'mi' | 'km';
  usePercentage: boolean;
  percentage?: number; // Percentage of 1RM
  useRPE: boolean;
  rpe?: string; // e.g., "7", "8-9"
  unilateral: boolean; // Single arm/leg
}

export interface WorkoutLog {
  id: string;
  scheduledWorkoutId: string;
  clientId: string;
  completedDate: Timestamp;
  exercises: Array<{
    movementId: string;
    prescribedSets: number;
    prescribedReps: string;
    prescribedRPE?: number;
    prescribedWeight?: number;
    actualSets: Array<{
      weight: number;
      reps: number;
      actualRPE: number;
    }>;
    estimatedOneRepMax: number;
    notes?: string;
  }>;
  sessionRPE: number;
  coachNotes?: string;
  athleteNotes?: string;
  createdAt: Timestamp;
}

export interface WeekTemplate {
  id: string;
  name: string;
  createdBy: string; // coach ID
  days: Array<{
    dayNumber: number; // 1-7
    workoutTemplateId: string;
    sessionType: string;
  }>;
  createdAt: Timestamp;
}

// RPE Calculation Types
export type RPEFormula = 'brzycki' | 'epley' | 'lander' | 'oconner' | 'tuchscherer' | 'average';

export interface RPECalculationResult {
  formula: RPEFormula;
  estimatedOneRepMax: number;
  recommendedWeight: number;
  accuracy: 'high' | 'medium' | 'low'; // based on rep range
}

// UI State Types
export interface WorkoutBuilderState {
  currentWorkout: WorkoutTemplate | null;
  selectedMovements: Movement[];
  isLoading: boolean;
  error: string | null;
}

export interface CalendarState {
  currentDate: Date;
  selectedDate: Date;
  viewMode: 'month' | 'week' | 'day';
  selectedClient: string | null;
  scheduledWorkouts: ScheduledWorkout[];
  isLoading: boolean;
}

// Form Types
export interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  goals?: string;
}

export interface WorkoutFormData {
  name: string;
  sessionType: string;
  rounds: WorkoutRound[];
  notes?: string;
}

// Workout Structure Templates
export interface WorkoutTypeConfiguration {
  // Similar to Movement configuration structure
  defaultRepRange?: { min: number; max: number };
  defaultRestPeriod?: { min: number; max: number }; // in seconds
  defaultDuration?: number; // in minutes
  defaultStructure?: 'straight-sets' | 'supersets' | 'circuits' | 'amrap' | 'emom' | 'intervals';
  useRPE?: boolean;
  usePercentage?: boolean;
  useTempo?: boolean;
  useTime?: boolean;
  workRestRatio?: string; // e.g., "1:1", "2:1"
  focusArea?: string; // e.g., "Dynamic warm-up", "Mobility & activation"
}

export interface WorkoutStructureTemplateSection {
  workoutTypeId: string; // References existing workout type
  workoutTypeName: string; // Denormalized for display
  order: number;
  configuration: WorkoutTypeConfiguration;
}

export interface WorkoutStructureTemplate {
  id: string;
  name: string;
  description?: string;
  sections: WorkoutStructureTemplateSection[]; // Ordered list
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
