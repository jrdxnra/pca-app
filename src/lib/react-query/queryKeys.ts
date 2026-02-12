/**
 * Query Key Factory
 * 
 * Centralized query key management for React Query.
 * This ensures consistent key structure and makes it easy to invalidate related queries.
 */

export const queryKeys = {
  // Movements
  movements: {
    all: ['movements'] as const,
    lists: () => [...queryKeys.movements.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.movements.lists(), filters] as const,
    details: () => [...queryKeys.movements.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.movements.details(), id] as const,
    byCategory: (categoryId: string) => [...queryKeys.movements.all, 'category', categoryId] as const,
    search: (searchTerm: string) => [...queryKeys.movements.all, 'search', searchTerm] as const,
  },

  // Movement Categories
  movementCategories: {
    all: ['movementCategories'] as const,
    lists: () => [...queryKeys.movementCategories.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.movementCategories.lists(), filters] as const,
    details: () => [...queryKeys.movementCategories.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.movementCategories.details(), id] as const,
  },

  // Clients
  clients: {
    all: ['clients'] as const,
    lists: () => [...queryKeys.clients.all, 'list'] as const,
    list: (filters?: { includeDeleted?: boolean }) => [...queryKeys.clients.lists(), filters] as const,
    details: () => [...queryKeys.clients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clients.details(), id] as const,
    search: (term: string, includeDeleted?: boolean) => [...queryKeys.clients.all, 'search', term, includeDeleted] as const,
  },

  // Programs
  programs: {
    all: ['programs'] as const,
    lists: () => [...queryKeys.programs.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.programs.lists(), filters] as const,
    details: () => [...queryKeys.programs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.programs.details(), id] as const,
    byClient: (clientId: string) => [...queryKeys.programs.all, 'client', clientId] as const,
  },

  // Client Programs
  clientPrograms: {
    all: ['clientPrograms'] as const,
    byClient: (clientId: string) => [...queryKeys.clientPrograms.all, 'client', clientId] as const,
  },

  // Client Workouts
  clientWorkouts: {
    all: ['clientWorkouts'] as const,
    lists: () => [...queryKeys.clientWorkouts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.clientWorkouts.lists(), filters] as const,
    details: () => [...queryKeys.clientWorkouts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clientWorkouts.details(), id] as const,
    byClient: (clientId: string) => [...queryKeys.clientWorkouts.all, 'client', clientId] as const,
    byDateRange: (clientId: string, startDate: string, endDate: string) =>
      [...queryKeys.clientWorkouts.all, 'client', clientId, 'dateRange', startDate, endDate] as const,
  },

  // Scheduled Workouts
  scheduledWorkouts: {
    all: ['scheduledWorkouts'] as const,
    lists: () => [...queryKeys.scheduledWorkouts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.scheduledWorkouts.lists(), filters] as const,
  },

  // Configuration
  periods: {
    all: ['periods'] as const,
    lists: () => [...queryKeys.periods.all, 'list'] as const,
  },

  weekTemplates: {
    all: ['weekTemplates'] as const,
    lists: () => [...queryKeys.weekTemplates.all, 'list'] as const,
  },

  workoutCategories: {
    all: ['workoutCategories'] as const,
    lists: () => [...queryKeys.workoutCategories.all, 'list'] as const,
  },

  workoutTypes: {
    all: ['workoutTypes'] as const,
    lists: () => [...queryKeys.workoutTypes.all, 'list'] as const,
  },

  workoutStructureTemplates: {
    all: ['workoutStructureTemplates'] as const,
    lists: () => [...queryKeys.workoutStructureTemplates.all, 'list'] as const,
    details: () => [...queryKeys.workoutStructureTemplates.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workoutStructureTemplates.details(), id] as const,
  },

  businessHours: {
    all: ['businessHours'] as const,
    current: () => [...queryKeys.businessHours.all, 'current'] as const,
  },

  // Calendar
  calendarEvents: {
    all: ['calendarEvents'] as const,
    lists: () => [...queryKeys.calendarEvents.all, 'list'] as const,
    list: (filters?: { start?: string; end?: string }) => [...queryKeys.calendarEvents.lists(), filters] as const,
    details: () => [...queryKeys.calendarEvents.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.calendarEvents.details(), id] as const,
  },

  calendarConfig: {
    all: ['calendarConfig'] as const,
    current: () => [...queryKeys.calendarConfig.all, 'current'] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    recentActivity: () => [...queryKeys.dashboard.all, 'recentActivity'] as const,
    upcomingSessions: () => [...queryKeys.dashboard.all, 'upcomingSessions'] as const,
    clientProgress: () => [...queryKeys.dashboard.all, 'clientProgress'] as const,
  },
} as const;
