"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Users, 
  Dumbbell, 
  TrendingUp, 
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  Cake
} from "lucide-react";
import { useDashboardStore } from '@/lib/stores/useDashboardStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { DayEventList } from '@/components/programs/DayEventList';
import { MiniCalendarTooltip } from '@/components/programs/MiniCalendarTooltip';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { getEventCategory } from '@/lib/utils/event-patterns';

export default function HomePage() {
  const {
    stats,
    recentActivity,
    upcomingSessions,
    clientProgress,
    loading,
    error,
    fetchDashboardData,
    clearError,
  } = useDashboardStore();

  const { clients, fetchClients } = useClientStore();
  const { events: calendarEvents, fetchEvents } = useCalendarStore();
  const { calendarDate, setCalendarDate } = useProgramStore();
  const { workoutCategories, fetchWorkoutCategories } = useConfigurationStore();

  // Selected date for mini calendar (defaults to calendarDate)
  // Initialize with null to avoid hydration mismatch, then set on client
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Sync selectedDate with calendarDate when it changes (e.g., from schedule page)
  useEffect(() => {
    setSelectedDate(calendarDate);
  }, [calendarDate]);

  // Initialize on mount (client-side only)
  useEffect(() => {
    if (selectedDate === null && calendarDate) {
      setSelectedDate(calendarDate);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
    fetchClients();
    fetchWorkoutCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - fetchDashboardData is stable from Zustand store

  // Fetch calendar events for current month (for analytics) and week (for sidebar)
  useEffect(() => {
    if (!calendarDate) return;

    const today = new Date();
    
    // Get week range for the calendar sidebar
    const startDate = new Date(calendarDate);
    startDate.setDate(calendarDate.getDate() - calendarDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get current month range for analytics
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Fetch the broader range (month) to cover both analytics and sidebar
    const fetchStart = monthStart < startDate ? monthStart : startDate;
    const fetchEnd = monthEnd > endDate ? monthEnd : endDate;
    
    fetchEvents({ start: fetchStart, end: fetchEnd });
  }, [calendarDate, fetchEvents]);

  // Handle mini calendar date selection
  const handleMiniCalendarDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCalendarDate(date);
  };

  // Handle event click
  const handleScheduleEventClick = (event: GoogleCalendarEvent) => {
    // Navigate to builder for clicked event
    const eventDate = new Date(event.start.dateTime);
    const dateParam = format(eventDate, 'yyyy-MM-dd');
    const clientId = event.preConfiguredClient || 
      event.description?.match(/client=([^,\s\]]+)/)?.[1];
    const clientParam = clientId ? `client=${clientId}&` : '';
    window.location.href = `/workouts/builder?${clientParam}date=${dateParam}`;
  };

  // Calculate analytics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Count today's sessions (all events for today)
  const todaysSessions = calendarEvents.filter(event => {
    const eventDate = new Date(event.start.dateTime);
    return eventDate >= today && eventDate <= todayEnd;
  }).length;

  // Get current month range
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get workout category names from configuration
  const workoutCategoryNames = workoutCategories.map(cat => cat.name);

  // Filter events for current month
  const monthEvents = calendarEvents.filter(event => {
    const eventDate = new Date(event.start.dateTime);
    return eventDate >= monthStart && eventDate <= monthEnd;
  });

  // Count scheduled workouts (events with workout categories)
  const scheduledWorkouts = monthEvents.filter(event => {
    const category = getEventCategory(event);
    return category && workoutCategoryNames.includes(category);
  });

  // Count assigned workouts (scheduled workouts with linkedWorkoutId)
  const assignedWorkouts = scheduledWorkouts.filter(event => !!event.linkedWorkoutId);

  const scheduledCount = scheduledWorkouts.length;
  const assignedCount = assignedWorkouts.length;
  const assignmentPercent = scheduledCount > 0 ? Math.round((assignedCount / scheduledCount) * 100) : 0;

  // Total clients count (excluding deleted)
  const totalClients = clients.filter(client => !client.isDeleted).length;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'client_added':
        return <Users className="h-4 w-4 icon-clients" />;
      case 'program_created':
        return <Calendar className="h-4 w-4 icon-schedule" />;
      case 'workout_completed':
        return <CheckCircle className="h-4 w-4 icon-builder" />;
      case 'workout_scheduled':
        return <Clock className="h-4 w-4 icon-schedule" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-1 pb-8 space-y-8">
      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-destructive">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout: Main content left, Day Events right */}
      <div className="flex gap-4">
        {/* Left side: Main dashboard content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today's Sessions */}
            <Card className="py-1 gap-0" style={{ minHeight: '88px', display: 'flex', flexDirection: 'column' }}>
              <CardContent className="px-2 pt-0 pb-2" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="text-xs text-muted-foreground">Today&apos;s Sessions</p>
                    <p className="text-2xl font-bold">{todaysSessions}</p>
                  </div>
                  <Calendar className="h-5 w-5 icon-schedule" />
                </div>
              </CardContent>
            </Card>

            {/* Client Progress */}
            <Card className="py-1 gap-0" style={{ minHeight: '88px', display: 'flex', flexDirection: 'column' }}>
              <CardContent className="px-2 pt-0 pb-2" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="text-xs text-muted-foreground">Workout Progress</p>
                    <p className="text-2xl font-bold">{assignedCount} / {scheduledCount}</p>
                    <p className="text-xs text-muted-foreground">{assignmentPercent}% assigned</p>
                  </div>
                  <TrendingUp className="h-5 w-5 icon-progress" />
                </div>
              </CardContent>
            </Card>

            {/* Total Clients */}
            <Card className="py-1 gap-0" style={{ minHeight: '88px', display: 'flex', flexDirection: 'column' }}>
              <CardContent className="px-2 pt-0 pb-2" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Clients</p>
                    <p className="text-2xl font-bold">{totalClients}</p>
                  </div>
                  <Users className="h-5 w-5 icon-clients" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No recent activity</h3>
                    <p className="text-muted-foreground">
                      Start by adding clients and creating programs.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 7).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2">
                    <div className="mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{activity.title}</div>
                      <div className="text-sm text-muted-foreground">{activity.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

            {/* Birthday Tracker */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cake className="h-5 w-5" />
                    Upcoming Birthdays
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const now = new Date();
                  const currentMonth = now.getMonth();
                  const currentYear = now.getFullYear();
                  
                  // Get clients with birthdays this month
                  const upcomingBirthdays = clients
                    .filter(client => !client.isDeleted && client.birthday)
                    .map(client => {
                      const birthdayStr = client.birthday!;
                      const [year, month, day] = birthdayStr.split('-').map(Number);
                      const birthdayThisYear = new Date(currentYear, month - 1, day);
                      const birthdayNextYear = new Date(currentYear + 1, month - 1, day);
                      
                      // Check if birthday is this month (current or next year)
                      let birthdayDate: Date;
                      if (month - 1 === currentMonth) {
                        birthdayDate = birthdayThisYear;
                      } else if (month - 1 < currentMonth) {
                        // Birthday already passed this year, use next year
                        birthdayDate = birthdayNextYear;
                      } else {
                        // Birthday is in future month, skip
                        return null;
                      }
                      
                      return {
                        client,
                        birthdayDate,
                        day,
                        month: month - 1
                      };
                    })
                    .filter((item): item is NonNullable<typeof item> => {
                      if (!item) return false;
                      // Only include if birthday is this month
                      return item.month === currentMonth;
                    })
                    .sort((a, b) => a.day - b.day);

                  if (upcomingBirthdays.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Cake className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No birthdays this month</h3>
                        <p className="text-muted-foreground">
                          No clients have birthdays coming up this month.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {upcomingBirthdays.map(({ client, birthdayDate, day }) => {
                        const isToday = birthdayDate.toDateString() === now.toDateString();
                        const daysUntil = Math.ceil((birthdayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Cake className="h-5 w-5 icon-birthday" />
                              <div>
                                <div className="font-medium">{client.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {format(birthdayDate, 'MMMM d')}
                                  {isToday && (
                                    <Badge className="ml-2 bg-pink-100 text-pink-800">Today!</Badge>
                                  )}
                                  {!isToday && daysUntil > 0 && (
                                    <span className="ml-2">• {daysUntil} {daysUntil === 1 ? 'day' : 'days'}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right side: Current Day Schedule (same as Schedule tab) */}
        {/* Note: selectedClientId is null to show ALL events for the day, regardless of client selection */}
        <div className="w-64 flex-shrink-0 sticky top-2 self-start">
          <DayEventList
            selectedDate={selectedDate || calendarDate}
            events={calendarEvents}
            clients={clients}
            selectedClientId={null}
            headerActions={
              <MiniCalendarTooltip
                currentDate={calendarDate}
                selectedDate={selectedDate || calendarDate}
                onDateSelect={handleMiniCalendarDateSelect}
              />
            }
            onEventClick={handleScheduleEventClick}
          />
        </div>
      </div>
    </div>
  );
}