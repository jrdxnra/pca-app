#!/usr/bin/env node

const PLANNER_API_BASE = process.env.PLANNER_API_BASE || 'http://localhost:3000/api/planner';

const WEEK_SLOTS = {
  '2026-04-27': [
    ['10:00', '10:30', 'Facility Support'],
    ['11:05', '11:55', "Coach's Choice"],
    ['12:00', '13:00', 'Lunch'],
    ['13:00', '14:00', 'Assigned - Matt'],
    ['14:00', '15:00', 'Open'],
    ['15:00', '16:00', 'Open'],
    ['16:00', '16:30', 'Admin'],
    ['16:30', '17:00', 'Facility Support'],
    ['17:00', '18:00', 'Open'],
    ['18:00', '18:30', 'Lunch'],
    ['18:30', '19:00', 'Facility Support'],
  ],
  '2026-04-28': [
    ['10:00', '11:00', 'Facility Support'],
    ['11:00', '12:00', 'Open'],
    ['12:00', '13:00', 'Lunch'],
    ['13:00', '14:00', 'Open'],
    ['14:00', '15:00', 'PL 201'],
    ['15:00', '16:00', 'Open'],
    ['16:00', '16:30', 'Class Prep'],
    ['16:35', '17:25', 'Total Body Strength'],
    ['17:30', '18:30', 'Open'],
    ['18:30', '19:00', 'Facility Support'],
  ],
  '2026-04-29': [
    ['10:00', '10:30', 'Facility Support'],
    ['10:30', '11:00', 'Class Prep'],
    ['11:05', '11:55', 'Total Body Conditioning'],
    ['12:00', '13:00', 'Lunch'],
    ['13:00', '14:00', 'Open'],
    ['14:00', '15:00', 'Open'],
    ['15:30', '16:00', 'Facility Support'],
    ['16:00', '16:30', 'Class Prep'],
    ['16:35', '17:25', 'Total Body Conditioning'],
    ['17:30', '18:30', 'Open'],
    ['18:30', '19:00', 'Facility Support'],
  ],
  '2026-04-30': [
    ['10:00', '11:00', 'Facility Support'],
    ['11:00', '12:00', 'Open'],
    ['12:00', '13:00', 'Lunch'],
    ['13:00', '14:00', 'Open'],
    ['14:00', '15:00', 'PL 201'],
    ['15:00', '16:00', 'Open'],
    ['16:00', '16:30', 'Class Prep'],
    ['16:35', '17:25', 'Total Body Strength'],
    ['17:30', '18:30', 'Open'],
    ['18:30', '19:00', 'Facility Support'],
  ],
  '2026-05-01': [
    ['10:00', '10:30', 'Facility Support'],
    ['10:30', '11:00', 'Class Prep'],
    ['11:05', '11:55', 'Total Body Conditioning'],
    ['12:00', '13:00', 'Lunch'],
    ['13:00', '14:00', 'Open'],
    ['14:00', '15:00', 'Open'],
    ['15:00', '16:00', 'Open'],
    ['16:00', '16:30', 'Admin'],
    ['16:30', '18:00', 'DNS'],
    ['18:00', '18:30', 'Lunch'],
    ['18:30', '19:00', 'Facility Support'],
  ],
};

function toLocalIso(day, hhmm) {
  return `${day}T${hhmm}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${PLANNER_API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${path}: ${text}`);
  }
  return payload;
}

function findByName(items, nameCandidates, field = 'name') {
  const normalized = new Set(nameCandidates.map((v) => String(v).trim().toLowerCase()));
  return items.find((item) => normalized.has(String(item?.[field] || '').trim().toLowerCase()));
}

async function ensureEventType(name, existingTypes) {
  const found = findByName(existingTypes, [name]);
  if (found) return found;
  try {
    const payload = await requestJson('/admin/event-types', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const created = findByName(payload.eventTypes || [], [name]);
    if (created) return created;
  } catch (error) {
    // If backend rejects creation, fallback to a known type below.
    console.warn(`Could not auto-create event type '${name}': ${error.message}`);
  }
  return null;
}

async function main() {
  console.log(`Seeding planner week via ${PLANNER_API_BASE}`);

  const bootstrap = await requestJson('/bootstrap');
  const calendars = bootstrap.calendars || [];
  const locations = bootstrap.locations || [];
  const eventTypes = bootstrap.eventTypes || [];

  const calendar = findByName(calendars, ['Clients/Training', 'Clients / Training']) || calendars[0];
  const location = findByName(locations, ['BV100'], 'building_name') || locations[0];

  if (!calendar) throw new Error('No calendars found in bootstrap.');
  if (!location) throw new Error('No locations found in bootstrap.');

  const weekStart = '2026-04-27T00:00:00';
  const weekEnd = '2026-05-02T00:00:00';
  const existingEvents = await requestJson(`/events?start=${encodeURIComponent(weekStart)}&end=${encodeURIComponent(weekEnd)}&calendar_id=${encodeURIComponent(calendar.id)}`);

  const existingKeySet = new Set(
    (existingEvents || []).map((evt) => {
      const start = String(evt.start_at || evt.start || '').slice(0, 16);
      const end = String(evt.end_at || evt.end || '').slice(0, 16);
      const title = String(evt.title || '').trim().toLowerCase();
      return `${start}|${end}|${title}`;
    })
  );

  let created = 0;
  let skipped = 0;
  let conflicted = 0;

  const allTypeNames = new Set((eventTypes || []).map((t) => String(t.name || '').trim().toLowerCase()));
  const fallbackType = eventTypes[0]?.name || 'Open';

  for (const [day, slots] of Object.entries(WEEK_SLOTS)) {
    for (const [startTime, endTime, title] of slots) {
      const startAt = toLocalIso(day, startTime);
      const endAt = toLocalIso(day, endTime);
      const key = `${startAt}|${endAt}|${title.trim().toLowerCase()}`;
      if (existingKeySet.has(key)) {
        skipped += 1;
        continue;
      }

      let eventType = title;
      if (!allTypeNames.has(eventType.trim().toLowerCase())) {
        const ensured = await ensureEventType(eventType, eventTypes);
        if (ensured) {
          eventTypes.push(ensured);
          allTypeNames.add(eventType.trim().toLowerCase());
        } else {
          eventType = fallbackType;
        }
      }

      try {
        await requestJson('/events', {
          method: 'POST',
          body: JSON.stringify({
            title,
            event_type: eventType,
            calendar_id: calendar.id,
            assigned_coach_id: 'planner-owner',
            location_id: location.id,
            start_at: startAt,
            end_at: endAt,
            client_name: '',
            client_count: 1,
            capacity_limit: 1,
            status: 'Scheduled',
            recurrence: 'none',
            repeat_weeks: 1,
          }),
        });
      } catch (error) {
        if (String(error.message || '').includes('Conflicts with')) {
          conflicted += 1;
          existingKeySet.add(key);
          continue;
        }
        throw error;
      }

      existingKeySet.add(key);
      created += 1;
    }
  }

  console.log(`Done. Created: ${created}, skipped existing: ${skipped}, conflicts skipped: ${conflicted}`);
  console.log(`Calendar used: ${calendar.name} (${calendar.id})`);
  console.log(`Location used: ${location.building_name} (${location.id})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
