'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { BootstrapData } from './PlannerClient';

interface AdminPanelProps {
  bootstrap: BootstrapData;
}

export default function AdminPanel({ bootstrap }: AdminPanelProps) {
  const [eventTypeName, setEventTypeName] = useState('');
  const [coachName, setCoachName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddEventType = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!eventTypeName.trim()) return;

    try {
      const res = await fetch('/api/planner/admin/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventTypeName,
          color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        }),
      });

      if (!res.ok) throw new Error('Failed to add event type');
      setSuccess('Event type added');
      setEventTypeName('');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event type');
    }
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!coachName.trim()) return;

    try {
      const res = await fetch('/api/planner/admin/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: coachName, role: 'Coach' }),
      });

      if (!res.ok) throw new Error('Failed to add coach');
      setSuccess('Coach added');
      setCoachName('');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add coach');
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!locationName.trim()) return;

    try {
      const res = await fetch('/api/planner/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_name: locationName,
          capacity: 10,
          equipment: '',
        }),
      });

      if (!res.ok) throw new Error('Failed to add location');
      setSuccess('Location added');
      setLocationName('');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add location');
    }
  };

  const handleAddCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!calendarName.trim()) return;

    try {
      const res = await fetch('/api/planner/admin/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: calendarName, description: '' }),
      });

      if (!res.ok) throw new Error('Failed to add calendar');
      setSuccess('Calendar added');
      setCalendarName('');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add calendar');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          ✓ {success}
        </div>
      )}

      {/* Event Types */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Event Types</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {bootstrap.eventTypes.map((et) => (
            <div key={et.id} className="flex items-center gap-2 text-xs p-1 bg-accent rounded">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: et.color }}
              />
              <span>{et.name}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddEventType} className="flex gap-2">
          <input
            type="text"
            placeholder="New type..."
            value={eventTypeName}
            onChange={(e) => setEventTypeName(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border rounded bg-background"
          />
          <button
            type="submit"
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {/* Coaches */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold text-sm">Coaches</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {bootstrap.users
            .filter((u) => u.role === 'Coach')
            .map((coach) => (
              <div key={coach.id} className="text-xs p-1 bg-accent rounded">
                {coach.name}
              </div>
            ))}
        </div>
        <form onSubmit={handleAddCoach} className="flex gap-2">
          <input
            type="text"
            placeholder="Coach name..."
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border rounded bg-background"
          />
          <button
            type="submit"
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {/* Locations */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold text-sm">Locations</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {bootstrap.locations.map((loc) => (
            <div key={loc.id} className="text-xs p-1 bg-accent rounded">
              {loc.building_name}
            </div>
          ))}
        </div>
        <form onSubmit={handleAddLocation} className="flex gap-2">
          <input
            type="text"
            placeholder="Location..."
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border rounded bg-background"
          />
          <button
            type="submit"
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {/* Calendars */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold text-sm">Calendars</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {bootstrap.calendars.map((cal) => (
            <div key={cal.id} className="text-xs p-1 bg-accent rounded">
              {cal.name}
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCalendar} className="flex gap-2">
          <input
            type="text"
            placeholder="Calendar..."
            value={calendarName}
            onChange={(e) => setCalendarName(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border rounded bg-background"
          />
          <button
            type="submit"
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
