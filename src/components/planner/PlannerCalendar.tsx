'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BootstrapData, CalendarEvent } from './PlannerClient';

interface PlannerCalendarProps {
  events: CalendarEvent[];
  bootstrap: BootstrapData;
  onEventClick: (event: CalendarEvent) => void;
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

export default function PlannerCalendar({
  events,
  bootstrap,
  onEventClick,
  onDateRangeChange,
}: PlannerCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day'>('week');

  const getDaysInView = () => {
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay()); // Start on Sunday
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      onDateRangeChange({ start, end });
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      return days;
    } else {
      onDateRangeChange({
        start: currentDate,
        end: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
      });
      return [currentDate];
    }
  };

  const days = getDaysInView();
  const businessHours = bootstrap.settings.businessHours;
  const startHour = parseInt(businessHours.start.split(':')[0]);
  const endHour = parseInt(businessHours.end.split(':')[0]);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const formatTime = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatDateFull = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const getEventsForTimeSlot = (day: Date, hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start_at);
      const eventEnd = new Date(event.end_at);
      const slotStart = new Date(day);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(day);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      return eventStart < slotEnd && eventEnd > slotStart;
    });
  };

  const getEventColor = (eventType: string) => {
    const type = bootstrap.eventTypes.find((et) => et.name === eventType);
    return type?.color || '#3b82f6';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between border-b bg-card p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold min-w-32">
            {view === 'week'
              ? `${formatDate(days[0])} - ${formatDate(days[days.length - 1])}`
              : formatDateFull(currentDate)}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              view === 'day' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              view === 'week' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid gap-0" style={{ display: 'grid', gridTemplateColumns: `.8fr repeat(${days.length}, 1fr)` }}>
          {/* Time column header - empty cell */}
          <div className="sticky left-0 top-0 z-20 bg-background border-r border-b p-2 text-xs font-semibold text-muted-foreground" />

          {/* Day headers */}
          {days.map((day, i) => (
            <div
              key={i}
              className="sticky top-0 z-20 bg-card border-r border-b p-3 text-center font-semibold text-sm"
            >
              <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="text-lg">{day.getDate()}</div>
            </div>
          ))}

          {/* Time slots */}
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              {/* Time label */}
              <div className="sticky left-0 z-10 bg-background border-r border-b p-2 text-xs font-semibold text-muted-foreground text-right">
                {formatTime(hour)}
              </div>

              {/* Time slots for each day */}
              {days.map((day, dayIndex) => {
                const slotEvents = getEventsForTimeSlot(day, hour);
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className="border-r border-b min-h-20 p-1 relative overflow-hidden"
                  >
                    {slotEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="p-1 rounded text-xs font-semibold text-white cursor-pointer hover:opacity-90 mb-0.5 truncate"
                        style={{ backgroundColor: getEventColor(event.event_type) }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
