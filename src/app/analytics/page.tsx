"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Calendar, Users } from "lucide-react";
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';
import { useClientStore } from '@/lib/stores/useClientStore';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export default function AnalyticsPage() {
  const { clients, fetchClients } = useClientStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');

  // Get current month range
  const today = new Date();
  const monthStart = startOfMonth(today);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = endOfMonth(today);
  monthEnd.setHours(23, 59, 59, 999);

  // Get current year range
  const yearStart = startOfYear(today);
  yearStart.setHours(0, 0, 0, 0);
  const yearEnd = endOfYear(today);
  yearEnd.setHours(23, 59, 59, 999);

  // Fetch calendar events for broader range
  const { data: calendarEvents = [], isLoading } = useCalendarEvents(
    yearStart,
    yearEnd
  );

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get the range to analyze based on selected period
  const rangeStart = selectedPeriod === 'month' ? monthStart : yearStart;
  const rangeEnd = selectedPeriod === 'month' ? monthEnd : yearEnd;

  // Filter events for selected period
  const periodEvents = calendarEvents.filter(event => {
    const eventDate = new Date(event.start.dateTime);
    return eventDate >= rangeStart && eventDate <= rangeEnd;
  });

  // Count coaching and class sessions
  const coachingSessions = periodEvents.filter(event => event.isCoachingSession).length;
  const classSessions = periodEvents.filter(event => event.isClassSession).length;
  const totalSessions = coachingSessions + classSessions;

  // Count unique clients engaged in coaching sessions
  const clientsWithSessions = new Set(
    periodEvents
      .filter(event => event.isCoachingSession || event.isClassSession)
      .map(event => event.preConfiguredClient || event.linkedWorkoutId)
      .filter(Boolean)
  ).size;

  // Count events by day of week for pattern analysis
  const eventsByDayOfWeek = new Map<string, number>();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  dayNames.forEach(day => eventsByDayOfWeek.set(day, 0));

  periodEvents.forEach(event => {
    const eventDate = new Date(event.start.dateTime);
    const dayName = dayNames[eventDate.getDay()];
    eventsByDayOfWeek.set(dayName, (eventsByDayOfWeek.get(dayName) || 0) + 1);
  });

  // Count active clients (excluding deleted)
  const activeClients = clients.filter(client => !client.isDeleted).length;

  // Average sessions per active client
  const avgSessionsPerClient = activeClients > 0 ? (totalSessions / activeClients).toFixed(1) : '0';

  const periodLabel = selectedPeriod === 'month' 
    ? format(today, 'MMMM yyyy')
    : format(today, 'yyyy');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="w-full px-4 pt-1 pb-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Analytics
            </h1>
            <p className="text-muted-foreground mt-1">Performance metrics and session data</p>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                selectedPeriod === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setSelectedPeriod('year')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                selectedPeriod === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              This Year
            </button>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Sessions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">{totalSessions}</p>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Coaching & Class sessions in {periodLabel}</p>
            </CardContent>
          </Card>

          {/* Coaching Sessions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coaching Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-blue-600">{coachingSessions}</p>
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Individual sessions</p>
            </CardContent>
          </Card>

          {/* Class Sessions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Class Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-purple-600">{classSessions}</p>
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Group sessions</p>
            </CardContent>
          </Card>

          {/* Avg Sessions per Client */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Sessions/Client</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-green-600">{avgSessionsPerClient}</p>
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Per active client</p>
            </CardContent>
          </Card>
        </div>

        {/* Session Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions by Day of Week */}
          <Card>
            <CardHeader>
              <CardTitle>Sessions by Day of Week</CardTitle>
              <CardDescription>Distribution of sessions throughout the week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from(eventsByDayOfWeek.entries()).map(([day, count]) => {
                  const maxCount = Math.max(...Array.from(eventsByDayOfWeek.values()));
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <p className="text-sm font-medium min-w-[70px]">{day}</p>
                      <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden relative">
                        <div
                          className="bg-primary h-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                        <p className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
                          {count}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Client Engagement */}
          <Card>
            <CardHeader>
              <CardTitle>Client Engagement</CardTitle>
              <CardDescription>Overview of client and session metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active Clients</p>
                  <p className="text-3xl font-bold">{activeClients}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Clients with Sessions ({periodLabel})
                  </p>
                  <p className="text-3xl font-bold">{clientsWithSessions}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Engagement Rate</p>
                  <p className="text-3xl font-bold text-green-600">
                    {activeClients > 0 ? Math.round((clientsWithSessions / activeClients) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">About This Analytics</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>
              • <strong>Total Sessions:</strong> Count of all coaching and class sessions detected in your calendar
            </p>
            <p>
              • <strong>Coaching Sessions:</strong> Individual one-on-one sessions identified by event detection keywords
            </p>
            <p>
              • <strong>Class Sessions:</strong> Group sessions identified by class keywords
            </p>
            <p>
              • <strong>Sessions by Day:</strong> Visual breakdown showing which days of the week are busiest
            </p>
            <p>
              • <strong>Engagement Rate:</strong> Percentage of active clients who had at least one session in the period
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
