import { create } from 'zustand';
import { 
  DashboardStats, 
  RecentActivity, 
  UpcomingSession,
  getDashboardStats,
  getRecentActivity,
  getUpcomingSessions,
  getClientProgressSummary,
  subscribeToDashboardStats
} from '@/lib/firebase/services/dashboard';

interface DashboardStore {
  // State
  stats: DashboardStats | null;
  recentActivity: RecentActivity[];
  upcomingSessions: UpcomingSession[];
  clientProgress: {
    clientId: string;
    clientName: string;
    totalWorkouts: number;
    completedWorkouts: number;
    completionRate: number;
    lastWorkout?: Date;
  }[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchDashboardData: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  fetchUpcomingSessions: () => Promise<void>;
  fetchClientProgress: () => Promise<void>;
  clearError: () => void;
  
  // Real-time subscriptions
  subscribeToStats: () => () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Initial State
  stats: null,
  recentActivity: [],
  upcomingSessions: [],
  clientProgress: [],
  loading: false,
  error: null,

  // Actions
  fetchDashboardData: async () => {
    set({ loading: true, error: null });
    try {
      // Fetch all dashboard data in parallel
      const [stats, recentActivity, upcomingSessions, clientProgress] = await Promise.all([
        getDashboardStats(),
        getRecentActivity(),
        getUpcomingSessions(),
        getClientProgressSummary(),
      ]);

      set({
        stats,
        recentActivity,
        upcomingSessions,
        clientProgress,
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
        loading: false,
      });
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await getDashboardStats();
      set({ stats, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
        loading: false,
      });
    }
  },

  fetchRecentActivity: async () => {
    try {
      const recentActivity = await getRecentActivity();
      set({ recentActivity });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch recent activity',
      });
    }
  },

  fetchUpcomingSessions: async () => {
    try {
      const upcomingSessions = await getUpcomingSessions();
      set({ upcomingSessions });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch upcoming sessions',
      });
    }
  },

  fetchClientProgress: async () => {
    try {
      const clientProgress = await getClientProgressSummary();
      set({ clientProgress });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch client progress',
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  // Real-time subscriptions
  subscribeToStats: () => {
    return subscribeToDashboardStats((stats) => {
      set({ stats });
    });
  },
}));
