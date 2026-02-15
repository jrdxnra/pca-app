import type { Timestamp } from 'firebase/firestore';

export interface Account {
  id: string;
  name: string;
  ownerId: string; // The primary user who owns the account (e.g., the trainer)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Membership {
  id: string;
  userId: string;
  accountId: string;
  role: 'owner' | 'trainer' | 'client';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Core Types
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthday?: string; // Format: YYYY-MM-DD
  notes?: string;
  goals?: string;
  eventGoals?: EventGoal[]; // Event goals for periodization planning
  trainingPhases?: TrainingPhase[]; // Visual training phase planning
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  personalRecords: Record<string, PersonalRecord>;
  recentExercisePerformance?: ClientRecentPerformance; // Recent weights and rep ranges by movement

  // Session tracking
  targetSessionsPerWeek?: number; // How many sessions client should do per week (baseline for billing)
  sessionCounts?: SessionCounts; // Actual session counts
  ownerId?: string; // User ID of the trainer who owns this client
}

export interface EventGoal {
  id: string;
  description: string;
  date: string; // ISO date string (YYYY-MM-DD)
}

export interface Period {
  id: string;
  name: string;
  color: string;
  focus: string;
  order?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

export interface TrainingPhase {
  id: string;
  periodConfigId: string;
  periodName: string;
  periodColor: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

export interface SessionCounts {
  // Current period counts (reset periodically)
  thisWeek: number;
  thisMonth: number;
  thisQuarter: number;
  thisYear: number;

  // All-time total
  total: number;

  // Last updated timestamp for recalculation
  lastUpdated?: Timestamp;

  // Period boundaries for accurate counting
  weekStart?: Timestamp; // Start of current week (for reset detection)
  monthStart?: Timestamp; // Start of current month
  quarterStart?: Timestamp; // Start of current quarter
  yearStart?: Timestamp; // Start of current year
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

export interface RecentExercisePerformance {
  movementId: string;
  weight: string; // Most recent weight used
  repRange: string; // Most recent rep range
  estimatedOneRepMax: number; // Current estimated 1RM (average of all formulas, or RPE-based if available)
  lastUsedDate: Timestamp;
  // 1RM History for tracking progression and graphing
  history?: Array<{
    estimatedOneRepMax: number;
    weight: string;
    reps: number;
    rpe?: number; // RPE if provided
    usedRPECalculation?: boolean; // true if Tuchscherer RPE formula was used
    date: Timestamp;
    isPR?: boolean; // Personal record flag (highest 1RM for this movement)
  }>;
}

export interface ClientRecentPerformance {
  // Keyed by movementId
  [movementId: string]: RecentExercisePerformance;
}

export interface MovementConfiguration {
  useReps: boolean;
  useTempo: boolean;
  useTime: boolean;
  timeMeasure?: 's' | 'm';
  useWeight: boolean;
  weightMeasure: 'lbs' | 'kg' | 'bw';
  useDistance: boolean;
  distanceMeasure: 'mi' | 'km' | 'm' | 'yd' | 'ft';
  usePace: boolean;
  paceMeasure: 'mi' | 'km';
  unilateral: boolean;
  usePercentage: boolean;
  useRPE: boolean;
}

export interface TargetWorkload extends MovementConfiguration {
  reps?: string;
  tempo?: string;
  time?: string;
  timeMeasure?: 's' | 'm';
  weight?: string;
  distance?: number;
  pace?: number;
  percentage?: number;
  rpe?: string;
}

export interface MovementCategory {
  id: string;
  name: string;
  color: string; // Hex color code
  order?: number;
  linkedWorkoutStructureTemplateId?: string; // Link to template
  defaultConfiguration?: MovementConfiguration;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

export type WorkoutCategory = MovementCategory;

export interface Movement {
  id: string;
  name: string;
  categoryId: string;
  category?: MovementCategory; // Populated when needed
  ordinal: number; // For ordering within category
  configuration: MovementConfiguration;
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
  ownerId?: string; // User ID of the trainer who owns this template
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
  ownerId?: string; // User ID of the trainer who owns this program
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

export interface ProgramTargetWorkload extends TargetWorkload {
  id: string;
  movementUsageId: string;
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
  time?: string; // Optional time in HH:MM format (for calendar display)
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
  ownerId?: string; // User ID of the trainer who owns this scheduled workout
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
  sessionType?: string; // Optional display label (kept for backward compatibility)
  notes?: string;
  time?: string; // HH:MM format
  duration?: number; // Optional duration in minutes (for calendar layout)
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
  ownerId?: string; // User ID of the trainer who owns this workout
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

export interface ClientWorkoutTargetWorkload extends TargetWorkload { }

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

export interface WeekTemplateDay {
  day: string;
  workoutCategory: string;
  variations?: string[];
}

export interface WeekTemplate {
  id: string;
  name: string;
  color: string;
  days: WeekTemplateDay[];
  order?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  ownerId?: string; // User ID of the trainer who owns this template
}

// RPE Calculation Types
export type RPEFormula = 'brzycki' | 'epley' | 'lander' | 'oconner' | 'tuchscherer' | 'average' | 'lombardi' | 'mayhew';

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
  error: string | null;
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
  createdBy?: string;
  ownerId?: string; // User ID of the trainer who owns this template
}

export interface WorkoutType {
  id: string;
  name: string;
  color: string;
  description: string;
  order?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

export interface DayHours {
  startHour: number;
  endHour: number;
}

export interface BusinessHours {
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayHours: { [dayIndex: number]: DayHours }; // Per-day hours
}
