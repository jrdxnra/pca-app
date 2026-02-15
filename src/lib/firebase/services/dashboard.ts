import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, getDb, auth } from '../config';
import { Client, Program, ScheduledWorkout, WorkoutTemplate, Movement, ClientWorkout } from '@/lib/types';

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalPrograms: number;
  activePrograms: number;
  totalWorkouts: number;
  completedWorkouts: number;
  totalMovements: number;
  upcomingWorkouts: number;
}

export interface RecentActivity {
  id: string;
  type: 'client_added' | 'program_created' | 'workout_completed' | 'workout_scheduled';
  title: string;
  description: string;
  timestamp: Timestamp;
  clientName?: string;
  programName?: string;
}

export interface UpcomingSession {
  id: string;
  clientId: string;
  clientName: string;
  date: Timestamp;
  sessionType: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  programName: string;
  roundCount: number;
}

// Helper to get current user ID
function getOwnerId(): string {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  return currentUser.uid;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const ownerId = getOwnerId();

    // Get all collections data filtered by ownerId
    const [clientsSnapshot, programsSnapshot, workoutsSnapshot, movementsSnapshot, scheduledWorkoutsSnapshot] = await Promise.all([
      getDocs(query(collection(getDb(), 'clients'), where('ownerId', '==', ownerId))),
      getDocs(query(collection(getDb(), 'programs'), where('ownerId', '==', ownerId))),
      getDocs(query(collection(getDb(), 'workout-templates'), where('ownerId', '==', ownerId))),
      getDocs(query(collection(getDb(), 'movements'), where('ownerId', '==', ownerId))),
      getDocs(query(collection(getDb(), 'scheduled-workouts'), where('ownerId', '==', ownerId)))
    ]);

    // Process clients
    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
    const totalClients = clients.length;
    const activeClients = clients.filter(client => !client.isDeleted).length;

    // Process programs
    const programs = programsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Program[];
    const totalPrograms = programs.length;
    const activePrograms = programs.filter(program => program.isTemplate).length;

    // Process workouts
    const totalWorkouts = workoutsSnapshot.size;

    // Process scheduled workouts
    const scheduledWorkouts = scheduledWorkoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScheduledWorkout[];
    const completedWorkouts = scheduledWorkouts.filter(workout => workout.status === 'completed').length;
    const upcomingWorkouts = scheduledWorkouts.filter(workout => {
      const workoutDate = workout.date.toDate();
      return workoutDate >= now && workout.status === 'scheduled';
    }).length;

    // Process movements
    const totalMovements = movementsSnapshot.size;

    return {
      totalClients,
      activeClients,
      totalPrograms,
      activePrograms,
      totalWorkouts,
      completedWorkouts,
      totalMovements,
      upcomingWorkouts,
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
}

/**
 * Get recent activity (last 30 days)
 */
export async function getRecentActivity(): Promise<RecentActivity[]> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ownerId = getOwnerId();

    // Get recent clients
    const recentClientsQuery = query(
      collection(getDb(), 'clients'),
      where('ownerId', '==', ownerId)
    );
    const recentClientsSnapshot = await getDocs(recentClientsQuery);

    // Client-side filter and sort
    const recentClients = recentClientsSnapshot.docs
      .map(doc => doc.data() as Client)
      .filter(client => client.createdAt.toMillis() >= thirtyDaysAgo.getTime())
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, 10);

    // Get recent programs
    const recentProgramsQuery = query(
      collection(getDb(), 'programs'),
      where('ownerId', '==', ownerId)
    );
    const recentProgramsSnapshot = await getDocs(recentProgramsQuery);

    // Client-side filter and sort
    const recentPrograms = recentProgramsSnapshot.docs
      .map(doc => doc.data() as Program)
      .filter(program => program.createdAt.toMillis() >= thirtyDaysAgo.getTime())
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, 10);

    // Get recent completed workouts
    const recentWorkoutsQuery = query(
      collection(getDb(), 'scheduled-workouts'),
      where('ownerId', '==', ownerId),
      where('status', '==', 'completed')
    );
    const recentWorkoutsSnapshot = await getDocs(recentWorkoutsQuery);

    // Client-side filter and sort
    const recentWorkouts = recentWorkoutsSnapshot.docs
      .map(doc => doc.data() as ScheduledWorkout)
      .filter(workout => (workout.updatedAt || workout.date).toMillis() >= thirtyDaysAgo.getTime())
      .sort((a, b) => (b.updatedAt || b.date).toMillis() - (a.updatedAt || a.date).toMillis())
      .slice(0, 10);

    const activities: RecentActivity[] = [];

    // Process recent clients
    recentClients.forEach(client => {
      activities.push({
        id: `client_${(client as any).id || Math.random().toString(36).substr(2, 9)}`,
        type: 'client_added',
        title: 'New Client Added',
        description: `${client.name} was added to your client roster`,
        timestamp: client.createdAt,
        clientName: client.name,
      });
    });

    // Process recent programs
    for (const program of recentPrograms) {

      activities.push({
        id: `program_${(program as any).id || Math.random().toString(36).substr(2, 9)}`,
        type: 'program_created',
        title: 'Program Template Created',
        description: `${program.name} template created`,
        timestamp: program.createdAt,
        programName: program.name,
      });
    }

    // Process recent completed workouts
    for (const workout of recentWorkouts) {

      // Get client name
      const clientDoc = await getDocs(query(
        collection(getDb(), 'clients'),
        where('__name__', '==', workout.clientId),
        limit(1)
      ));

      const clientName = clientDoc.docs[0]?.data()?.name || 'Unknown Client';

      activities.push({
        id: `workout_${(workout as any).id || Math.random().toString(36).substr(2, 9)}`,
        type: 'workout_completed',
        title: 'Workout Completed',
        description: `${clientName} completed ${workout.sessionType}`,
        timestamp: workout.updatedAt || workout.date,
        clientName,
      });
    }

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

    return activities.slice(0, 15); // Return top 15 most recent
  } catch (error) {
    console.error('Error getting recent activity:', error);
    throw error;
  }
}

/**
 * Get upcoming sessions (next 7 days)
 */
export async function getUpcomingSessions(): Promise<UpcomingSession[]> {
  try {
    // Use start of today to include all sessions for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(startOfToday.getTime() + (7 * 24 * 60 * 60 * 1000));
    sevenDaysFromNow.setHours(23, 59, 59, 999); // End of day 7 days from now

    const ownerId = getOwnerId();

    // Get upcoming client workouts (the actual workouts being used)
    const upcomingQuery = query(
      collection(getDb(), 'clientWorkouts'),
      where('ownerId', '==', ownerId),
      where('date', '>=', Timestamp.fromDate(startOfToday)),
      where('date', '<=', Timestamp.fromDate(sevenDaysFromNow))
      // Removed orderBy to avoid composite index requirement
    );

    const upcomingSnapshot = await getDocs(upcomingQuery);
    const sessions: UpcomingSession[] = [];

    // Get all unique client IDs to batch fetch client names
    const clientIds = [...new Set(upcomingSnapshot.docs.map(doc => {
      const workout = doc.data();
      return workout.clientId;
    }).filter(Boolean))];

    // Fetch all clients (handle Firestore 'in' query limit of 10 by batching)
    const clientsMap = new Map<string, string>();
    if (clientIds.length > 0) {
      // Batch fetch clients in groups of 10
      for (let i = 0; i < clientIds.length; i += 10) {
        const batch = clientIds.slice(i, i + 10);
        const clientsQuery = query(
          collection(getDb(), 'clients'),
          where('__name__', 'in', batch)
        );
        const clientsSnapshot = await getDocs(clientsQuery);
        clientsSnapshot.docs.forEach(doc => {
          clientsMap.set(doc.id, doc.data().name || 'Unknown Client');
        });
      }
    }

    for (const doc of upcomingSnapshot.docs) {
      const workout = doc.data() as any; // ClientWorkout type

      const clientName = clientsMap.get(workout.clientId) || 'Unknown Client';
      const sessionType = workout.categoryName || workout.title || 'Workout';
      const roundCount = workout.rounds?.length || 0;

      sessions.push({
        id: doc.id,
        clientId: workout.clientId,
        clientName,
        date: workout.date,
        sessionType,
        status: 'scheduled' as const, // ClientWorkouts are always scheduled
        programName: workout.programId ? 'Program' : 'No Program',
        roundCount,
      });
    }

    // Sort by date (ascending) and limit to 20
    sessions.sort((a, b) => {
      const dateA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
      const dateB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
      return dateA - dateB;
    });
    return sessions.slice(0, 20);
  } catch (error) {
    console.error('Error getting upcoming sessions:', error);
    throw error;
  }
}

/**
 * Get client progress summary
 */
export async function getClientProgressSummary(): Promise<{
  clientId: string;
  clientName: string;
  totalWorkouts: number;
  completedWorkouts: number;
  completionRate: number;
  lastWorkout?: Date;
}[]> {
  try {
    const ownerId = getOwnerId();

    // Get all active clients
    const clientsQuery = query(
      collection(getDb(), 'clients'),
      where('ownerId', '==', ownerId),
      where('isDeleted', '==', false)
    );
    const clientsSnapshot = await getDocs(clientsQuery);

    const progressSummary = [];

    for (const clientDoc of clientsSnapshot.docs) {
      const client = clientDoc.data() as Client;

      // Get client's scheduled workouts
      const workoutsQuery = query(
        collection(getDb(), 'scheduled-workouts'),
        where('clientId', '==', clientDoc.id)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);

      const workouts = workoutsSnapshot.docs.map(doc => doc.data() as ScheduledWorkout);
      const totalWorkouts = workouts.length;
      const completedWorkouts = workouts.filter(w => w.status === 'completed').length;
      const completionRate = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

      // Find last completed workout
      const completedWorkoutDates = workouts
        .filter(w => w.status === 'completed')
        .map(w => w.date.toDate())
        .sort((a, b) => b.getTime() - a.getTime());

      const lastWorkout = completedWorkoutDates[0];

      progressSummary.push({
        clientId: clientDoc.id,
        clientName: client.name,
        totalWorkouts,
        completedWorkouts,
        completionRate,
        lastWorkout,
      });
    }

    // Sort by completion rate (highest first)
    progressSummary.sort((a, b) => b.completionRate - a.completionRate);

    return progressSummary;
  } catch (error) {
    console.error('Error getting client progress summary:', error);
    throw error;
  }
}

/**
 * Real-time dashboard stats subscription
 */
export function subscribeToDashboardStats(callback: (stats: DashboardStats) => void): () => void {
  // For real-time updates, we'll need to subscribe to multiple collections
  // This is a simplified version - in production you might want to optimize this

  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Unauthorized access attempt to subscribeToDashboardStats');
    return () => { };
  }
  const ownerId = currentUser.uid;

  const unsubscribeFunctions: (() => void)[] = [];

  // Subscribe to clients changes
  const clientsQuery = query(collection(getDb(), 'clients'), where('ownerId', '==', ownerId));
  const clientsUnsubscribe = onSnapshot(clientsQuery, () => {
    // Recalculate stats when any collection changes
    getDashboardStats().then(callback).catch(console.error);
  });

  // Subscribe to programs changes
  const programsQuery = query(collection(getDb(), 'programs'), where('ownerId', '==', ownerId));
  const programsUnsubscribe = onSnapshot(programsQuery, () => {
    getDashboardStats().then(callback).catch(console.error);
  });

  // Subscribe to scheduled workouts changes
  const workoutsQuery = query(collection(getDb(), 'scheduled-workouts'), where('ownerId', '==', ownerId));
  const workoutsUnsubscribe = onSnapshot(workoutsQuery, () => {
    getDashboardStats().then(callback).catch(console.error);
  });

  unsubscribeFunctions.push(clientsUnsubscribe, programsUnsubscribe, workoutsUnsubscribe);

  // Return cleanup function
  return () => {
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
  };
}
