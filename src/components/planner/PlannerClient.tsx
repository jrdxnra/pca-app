'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Settings, Plus, X } from 'lucide-react';
import PlannerCalendar from './PlannerCalendar';
import AdminPanel from './AdminPanel';
import EventEditor from './EventEditor';

export interface BootstrapData {
  users: Array<any>;
  locations: Array<any>;
  holidays: Array<any>;
  calendars: Array<any>;
  eventTypes: Array<any>;
  settings: {
    businessHours: { start: string; end: string };
    businessHoursWeek: Record<string, any>;
    showWeekends: boolean;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  assigned_coach_id: string;
  calendar_id: string;
  location_id: string;
  client_name: string;
  client_count: number;
  capacity_limit: number;
  status: string;
  recurrence: string;
  co_coach_id?: string;
}

export default function PlannerClient() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Load bootstrap data
  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const res = await fetch('/api/planner/bootstrap');
        if (!res.ok) throw new Error('Failed to load bootstrap data');
        const data = await res.json();
        setBootstrap(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    loadBootstrap();
  }, []);

  // Load events whenever date range changes
  useEffect(() => {
    if (!bootstrap) return;

    const loadEvents = async () => {
      try {
        const start = dateRange.start.toISOString();
        const end = dateRange.end.toISOString();
        const res = await fetch(`/api/planner/events?start=${start}&end=${end}`);
        if (!res.ok) throw new Error('Failed to load events');
        const data = await res.json();
        setEvents(data);
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    };

    loadEvents();
  }, [bootstrap, dateRange]);

  const handleEventCreate = useCallback(
    async (eventData: Partial<CalendarEvent>) => {
      try {
        const res = await fetch('/api/planner/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
        if (!res.ok) throw new Error('Failed to create event');
        const newEvent = await res.json();
        setEvents([...events, newEvent]);
        setSelectedEvent(null);
      } catch (err) {
        console.error('Failed to create event:', err);
      }
    },
    [events]
  );

  const handleEventUpdate = useCallback(
    async (eventId: string, eventData: Partial<CalendarEvent>) => {
      try {
        const res = await fetch(`/api/planner/events/${eventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
        if (!res.ok) throw new Error('Failed to update event');
        const updated = await res.json();
        setEvents(events.map((e) => (e.id === eventId ? updated : e)));
        setSelectedEvent(null);
      } catch (err) {
        console.error('Failed to update event:', err);
      }
    },
    [events]
  );

  const handleEventDelete = useCallback(
    async (eventId: string) => {
      try {
        const res = await fetch(`/api/planner/events?event_id=${eventId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete event');
        setEvents(events.filter((e) => e.id !== eventId));
        setSelectedEvent(null);
      } catch (err) {
        console.error('Failed to delete event:', err);
      }
    },
    [events]
  );

  if (loading || !bootstrap) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading planner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="layout-grid">
        {/* Calendar on the left */}
        <div className="calendar-shell">
          <div className="toolbar-row">
            <h2 className="text-lg font-semibold">Schedule</h2>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setSelectedEvent({})}
                className="primary-button"
              >
                <Plus className="inline-block w-4 h-4 mr-1" />
                New Event
              </button>
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className="ghost-button"
              >
                <Settings className="inline-block w-4 h-4 mr-1" />
                Admin
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <PlannerCalendar
              events={events}
              bootstrap={bootstrap}
              onEventClick={(event) => setSelectedEvent(event)}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>

        {/* Event form on the right */}
        {selectedEvent && (
          <div className="form-shell">
            <div className="panel-header">
              <h2>
                {selectedEvent.id ? 'Edit Event' : 'New Event'}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="ghost-button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <EventEditor
              event={selectedEvent}
              bootstrap={bootstrap}
              onCreate={handleEventCreate}
              onUpdate={handleEventUpdate}
              onDelete={handleEventDelete}
            />
          </div>
        )}
      </div>

      {/* Admin Panel - Floating */}
      {showAdmin && (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h2>Admin Controls</h2>
            <button
              onClick={() => setShowAdmin(false)}
              className="ghost-button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <AdminPanel bootstrap={bootstrap} />
        </div>
      )}
    </div>
  );
}
