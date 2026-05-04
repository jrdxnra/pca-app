'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { BootstrapData, CalendarEvent } from './PlannerClient';

interface EventEditorProps {
  event: Partial<CalendarEvent>;
  bootstrap: BootstrapData;
  onCreate: (event: Partial<CalendarEvent>) => Promise<void>;
  onUpdate: (id: string, event: Partial<CalendarEvent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function EventEditor({
  event,
  bootstrap,
  onCreate,
  onUpdate,
  onDelete,
}: EventEditorProps) {
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    title: '',
    event_type: bootstrap.eventTypes[0]?.name || 'In Person Meeting',
    calendar_id: bootstrap.calendars[0]?.id || '',
    assigned_coach_id: bootstrap.users.find((u) => u.role === 'Coach')?.id || '',
    location_id: bootstrap.locations[0]?.id || '',
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    client_name: '',
    client_count: 1,
    capacity_limit: 1,
    status: 'Scheduled',
    recurrence: 'none',
    ...event,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      title: '',
      event_type: bootstrap.eventTypes[0]?.name || 'In Person Meeting',
      calendar_id: bootstrap.calendars[0]?.id || '',
      assigned_coach_id: bootstrap.users.find((u) => u.role === 'Coach')?.id || '',
      location_id: bootstrap.locations[0]?.id || '',
      start_at: new Date().toISOString(),
      end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      client_name: '',
      client_count: 1,
      capacity_limit: 1,
      status: 'Scheduled',
      recurrence: 'none',
      ...event,
    });
  }, [event, bootstrap]);

  const handleChange = (field: keyof CalendarEvent, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (event.id) {
        await onUpdate(event.id, formData);
      } else {
        await onCreate(formData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event.id || !confirm('Delete this event?')) return;

    setSaving(true);
    setError(null);

    try {
      await onDelete(event.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold mb-1">Title</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
          placeholder="Event title"
          required
        />
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-xs font-semibold mb-1">Event Type</label>
        <select
          value={formData.event_type || ''}
          onChange={(e) => handleChange('event_type', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        >
          {bootstrap.eventTypes.map((et) => (
            <option key={et.id} value={et.name}>
              {et.name}
            </option>
          ))}
        </select>
      </div>

      {/* Calendar */}
      <div>
        <label className="block text-xs font-semibold mb-1">Calendar</label>
        <select
          value={formData.calendar_id || ''}
          onChange={(e) => handleChange('calendar_id', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        >
          {bootstrap.calendars.map((cal) => (
            <option key={cal.id} value={cal.id}>
              {cal.name}
            </option>
          ))}
        </select>
      </div>

      {/* Coach */}
      <div>
        <label className="block text-xs font-semibold mb-1">Coach</label>
        <select
          value={formData.assigned_coach_id || ''}
          onChange={(e) => handleChange('assigned_coach_id', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        >
          {bootstrap.users
            .filter((u) => u.role === 'Coach')
            .map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="block text-xs font-semibold mb-1">Location</label>
        <select
          value={formData.location_id || ''}
          onChange={(e) => handleChange('location_id', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        >
          {bootstrap.locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.building_name}
            </option>
          ))}
        </select>
      </div>

      {/* Start Time */}
      <div>
        <label className="block text-xs font-semibold mb-1">Start</label>
        <input
          type="datetime-local"
          value={new Date(formData.start_at || '').toISOString().slice(0, 16)}
          onChange={(e) =>
            handleChange('start_at', new Date(e.target.value).toISOString())
          }
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        />
      </div>

      {/* End Time */}
      <div>
        <label className="block text-xs font-semibold mb-1">End</label>
        <input
          type="datetime-local"
          value={new Date(formData.end_at || '').toISOString().slice(0, 16)}
          onChange={(e) => handleChange('end_at', new Date(e.target.value).toISOString())}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        />
      </div>

      {/* Client Name */}
      <div>
        <label className="block text-xs font-semibold mb-1">Client Name</label>
        <input
          type="text"
          value={formData.client_name || ''}
          onChange={(e) => handleChange('client_name', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
          placeholder="Optional"
        />
      </div>

      {/* Client Count */}
      <div>
        <label className="block text-xs font-semibold mb-1">Client Count</label>
        <input
          type="number"
          value={formData.client_count || 1}
          onChange={(e) => handleChange('client_count', parseInt(e.target.value))}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
          min="1"
        />
      </div>

      {/* Capacity Limit */}
      <div>
        <label className="block text-xs font-semibold mb-1">Capacity</label>
        <input
          type="number"
          value={formData.capacity_limit || 1}
          onChange={(e) => handleChange('capacity_limit', parseInt(e.target.value))}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
          min="1"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs font-semibold mb-1">Status</label>
        <select
          value={formData.status || 'Scheduled'}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Recurrence */}
      <div>
        <label className="block text-xs font-semibold mb-1">Recurrence</label>
        <select
          value={formData.recurrence || 'none'}
          onChange={(e) => handleChange('recurrence', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving...' : event.id ? 'Update' : 'Create'}
        </button>

        {event.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="p-2 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
  );
}
