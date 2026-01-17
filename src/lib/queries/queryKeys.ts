/**
 * Centralized query keys for React Query
 * Ensures consistent key structure across the app
 */
export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    lists: () => [...queryKeys.clients.all, 'list'] as const,
    list: (filters: { includeDeleted?: boolean } = {}) => 
      [...queryKeys.clients.lists(), filters] as const,
    details: () => [...queryKeys.clients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clients.details(), id] as const,
    search: (term: string, includeDeleted?: boolean) => 
      [...queryKeys.clients.all, 'search', term, includeDeleted] as const,
  },
  programs: {
    all: ['programs'] as const,
    lists: () => [...queryKeys.programs.all, 'list'] as const,
    list: (filters?: { clientId?: string }) => 
      [...queryKeys.programs.lists(), filters] as const,
    details: () => [...queryKeys.programs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.programs.details(), id] as const,
  },
  scheduledWorkouts: {
    all: ['scheduledWorkouts'] as const,
    lists: () => [...queryKeys.scheduledWorkouts.all, 'list'] as const,
    list: (filters?: { programId?: string; clientId?: string; dateRange?: { start: Date; end: Date } }) => 
      [...queryKeys.scheduledWorkouts.lists(), filters] as const,
  },
  calendar: {
    all: ['calendar'] as const,
    events: (dateRange: { start: Date; end: Date }) => 
      [...queryKeys.calendar.all, 'events', dateRange] as const,
    calendars: () => [...queryKeys.calendar.all, 'calendars'] as const,
    config: () => [...queryKeys.calendar.all, 'config'] as const,
  },
  configuration: {
    all: ['configuration'] as const,
    periods: () => [...queryKeys.configuration.all, 'periods'] as const,
    weekTemplates: () => [...queryKeys.configuration.all, 'weekTemplates'] as const,
    workoutCategories: () => [...queryKeys.configuration.all, 'workoutCategories'] as const,
    workoutStructureTemplates: () => [...queryKeys.configuration.all, 'workoutStructureTemplates'] as const,
  },
} as const;
