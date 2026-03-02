"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Calendar, Users } from "lucide-react";
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';
import { useClientStore } from '@/lib/stores/useClientStore';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { getCalendarSyncConfig } from '@/lib/firebase/services/calendarConfig';

const COLOR_HEX_MAP = {
  blue:   { bar: '#3b82f6', text: '#2563eb' },
  green:  { bar: '#22c55e', text: '#16a34a' },
  purple: { bar: '#a21caf', text: '#7e22ce' },
  orange: { bar: '#f97316', text: '#ea580c' },
  red:    { bar: '#ef4444', text: '#dc2626' },
  yellow: { bar: '#eab308', text: '#ca8a04' },
  pink:   { bar: '#ec4899', text: '#db2777' },
  indigo: { bar: '#6366f1', text: '#4f46e5' },
  teal:   { bar: '#14b8a6', text: '#0d9488' },
};

type ColorKey = keyof typeof COLOR_HEX_MAP;

const isColorKey = (value: string): value is ColorKey => value in COLOR_HEX_MAP;

const ensureColor = (candidate: string | null | undefined, fallback: ColorKey): ColorKey =>
  candidate && isColorKey(candidate) ? candidate : fallback;

export default function AnalyticsPage() {
  const { clients, fetchClients } = useClientStore();

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

  // Fetch user-configured colors for coaching/class
  const [coachingColor, setCoachingColor] = useState<ColorKey>('blue');
  const [classColor, setClassColor] = useState<ColorKey>('green');
  useEffect(() => {
    getCalendarSyncConfig({ coachingColor: 'blue', classColor: 'green', coachingKeywords: [], classKeywords: [] })
      .then(cfg => {
        setCoachingColor(ensureColor(cfg.coachingColor, 'blue'));
        setClassColor(ensureColor(cfg.classColor, 'green'));
      });
  }, []);

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Filter events for current month and year
  const monthEvents = calendarEvents.filter(event => {
    const eventDate = new Date(event.start.dateTime);
    return eventDate >= monthStart && eventDate <= monthEnd;
  });
  const yearEvents = calendarEvents.filter(event => {
    const eventDate = new Date(event.start.dateTime);
    return eventDate >= yearStart && eventDate <= yearEnd;
  });

  // Count coaching and class sessions for current month
  const coachingSessions = monthEvents.filter(event => event.isCoachingSession).length;
  const classSessions = monthEvents.filter(event => event.isClassSession).length;
  const totalSessions = coachingSessions + classSessions;

  // Count unique clients engaged in coaching/class sessions for current month
  const clientsWithSessions = new Set(
    monthEvents
      .filter(event => event.isCoachingSession || event.isClassSession)
      .map(event => event.preConfiguredClient || event.linkedWorkoutId)
      .filter(Boolean)
  ).size;

  // Count coaching and class sessions by day of week for current month
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sessionsByDay: { [day: string]: { coaching: number; classes: number } } = {};
  dayNames.forEach(day => {
    sessionsByDay[day] = { coaching: 0, classes: 0 };
  });
  monthEvents.forEach(event => {
    const eventDate = new Date(event.start.dateTime);
    const dayName = dayNames[eventDate.getDay()];
    if (event.isCoachingSession) {
      sessionsByDay[dayName].coaching += 1;
    }
    if (event.isClassSession) {
      sessionsByDay[dayName].classes += 1;
    }
  });

  // Count active clients (excluding deleted)
  const activeClients = clients.filter(client => !client.isDeleted).length;

  // Average sessions per active client

  const avgSessionsPerClient = activeClients > 0 ? (totalSessions / activeClients).toFixed(1) : '0';
  const periodLabel = format(today, 'MMMM yyyy');

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
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-8 w-8" />
          <h1 className="text-4xl font-bold">Analytics</h1>
        </div>
        <p className="text-muted-foreground mb-4">Performance metrics and session data</p>
        {/* Consolidated Top Row: This Week, This Month, This Year */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* This Week Total */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold" style={{ color: (COLOR_HEX_MAP[coachingColor]?.text) || '#2563eb' }}>
                  {(() => {
                    const now = new Date();
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    weekEnd.setHours(23, 59, 59, 999);
                    const weekEvents = calendarEvents.filter(event => {
                      const eventDate = new Date(event.start.dateTime);
                      return eventDate >= weekStart && eventDate <= weekEnd;
                    });
                    return weekEvents.filter(event => event.isCoachingSession || event.isClassSession).length;
                  })()}
                </p>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Sessions this week</p>
            </CardContent>
          </Card>
          {/* This Month Total */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold" style={{ color: (COLOR_HEX_MAP[coachingColor]?.text) || '#2563eb' }}>
                  {calendarEvents.filter(event => {
                    const eventDate = new Date(event.start.dateTime);
                    return eventDate >= monthStart && eventDate <= monthEnd && (event.isCoachingSession || event.isClassSession);
                  }).length}
                </p>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Sessions this month</p>
            </CardContent>
          </Card>
          {/* This Year Total */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Year</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold" style={{ color: (COLOR_HEX_MAP[classColor]?.text) || '#16a34a' }}>
                  {calendarEvents.filter(event => {
                    const eventDate = new Date(event.start.dateTime);
                    return eventDate >= yearStart && eventDate <= yearEnd && (event.isCoachingSession || event.isClassSession);
                  }).length}
                </p>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Sessions this year</p>
            </CardContent>
          </Card>
        </div>
        {/* Key Stats (no Total Sessions card) */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">

          {/* Coaching Sessions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coaching Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold" style={{ color: (COLOR_HEX_MAP[coachingColor]?.text) || '#2563eb' }}>{coachingSessions}</p>
                <TrendingUp className="h-5 w-5" style={{ color: (COLOR_HEX_MAP[coachingColor]?.text) || '#2563eb' }} />
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
                <p className="text-3xl font-bold" style={{ color: (COLOR_HEX_MAP[classColor]?.text) || '#16a34a' }}>{classSessions}</p>
                <Users className="h-5 w-5" style={{ color: (COLOR_HEX_MAP[classColor]?.text) || '#16a34a' }} />
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
                <p className="text-3xl font-bold" style={{ color: '#16a34a' }}>{avgSessionsPerClient}</p>
                <BarChart3 className="h-5 w-5" style={{ color: '#16a34a' }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Per active client</p>
            </CardContent>
          </Card>
        </div>

        {/* Session Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Grouped Bar Chart for Last 6 Months */}
          <Card>
            <CardHeader>
              <CardTitle>Sessions by Month (Last 6 Months)</CardTitle>
              <CardDescription>Coaching, Class, and Client counts per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-6 mb-6 h-64">
                {(() => {
                  type MonthBucket = {
                    label: string;
                    year: number;
                    month: number;
                    start: Date;
                    end: Date;
                  };

                  const months: MonthBucket[] = [];
                  const now = new Date();
                  for (let i = 5; i >= 0; i--) {
                    const firstOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    months.push({
                      label: firstOfMonth.toLocaleString('default', { month: 'short' }),
                      year: firstOfMonth.getFullYear(),
                      month: firstOfMonth.getMonth(),
                      start: new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1),
                      end: new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0, 23, 59, 59, 999)
                    });
                  }

                  const bucketData = months.map(bucket => {
                    const monthEvents = calendarEvents.filter(event => {
                      const eventDate = new Date(event.start.dateTime);
                      return eventDate >= bucket.start && eventDate <= bucket.end;
                    });
                    const coachingCount = monthEvents.filter(e => e.isCoachingSession).length;
                    const classCount = monthEvents.filter(e => e.isClassSession).length;
                    return {
                      ...bucket,
                      coachingCount,
                      classCount,
                      clientCount: activeClients
                    };
                  });

                  const allCounts = bucketData.flatMap(data => [data.coachingCount, data.classCount, data.clientCount]);
                  const globalMaxCount = Math.max(...allCounts, 1);

                  return bucketData.map(({ label, year, coachingCount, classCount, clientCount }) => (
                    <div key={label + year} className="flex flex-col items-center w-16">
                      <div className="flex items-end gap-1 h-48 relative">
                        {/* Coaching bar */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold mb-1" style={{ color: (COLOR_HEX_MAP[coachingColor]?.text) || '#2563eb' }}>{coachingCount}</span>
                          <div
                            className="w-4 rounded-t transition-all duration-300"
                            style={{
                              height: `${Math.max((coachingCount / globalMaxCount) * 140, 0)}px`,
                              backgroundColor: (COLOR_HEX_MAP[coachingColor]?.bar) || '#3b82f6'
                            }}
                            title={`Coaching: ${coachingCount}`}
                          />
                        </div>
                        {/* Class bar */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold mb-1" style={{ color: (COLOR_HEX_MAP[classColor]?.text) || '#16a34a' }}>{classCount}</span>
                          <div
                            className="w-4 rounded-t transition-all duration-300"
                            style={{
                              height: `${Math.max((classCount / globalMaxCount) * 140, 0)}px`,
                              backgroundColor: (COLOR_HEX_MAP[classColor]?.bar) || '#22c55e'
                            }}
                            title={`Class: ${classCount}`}
                          />
                        </div>
                        {/* Client bar (always green) */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold mb-1" style={{ color: '#16a34a' }}>{clientCount}</span>
                          <div
                            className="w-4 rounded-t transition-all duration-300"
                            style={{
                              height: `${Math.max((clientCount / globalMaxCount) * 140, 0)}px`,
                              backgroundColor: '#22c55e'
                            }}
                            title={`Clients: ${clientCount}`}
                          />
                        </div>
                      </div>
                      <span className="mt-2 text-xs font-medium text-muted-foreground">{label}</span>
                    </div>
                  ));
                })()}
              </div>
              {/* Legend */}
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: (COLOR_HEX_MAP[coachingColor]?.bar) || '#3b82f6' }} />
                  <span className="text-xs">Coaching</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: (COLOR_HEX_MAP[classColor]?.bar) || '#22c55e' }} />
                  <span className="text-xs">Class</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-xs">Clients</span>
                </div>
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

      </div>
    </AuthGuard>
  );
}
