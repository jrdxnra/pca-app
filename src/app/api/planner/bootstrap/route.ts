import { NextRequest, NextResponse } from 'next/server';

const FITSHIFT_API = process.env.FITSHIFT_API_URL || 'https://pca-planner-service-awu2h3ecyq-uc.a.run.app';

// Minimal default bootstrap data for when planner service is unavailable
const DEFAULT_BOOTSTRAP = {
  calendars: [],
  eventTypes: [
    { name: 'Session' },
    { name: 'Consultation' },
  ],
  locations: [],
  users: [],
  settings: {
    showWeekends: false,
    plannerMode: 'live',
    businessHoursWeek: {
      '0': { enabled: true, start: '10:00', end: '19:00' },
      '1': { enabled: true, start: '10:00', end: '19:00' },
      '2': { enabled: true, start: '10:00', end: '19:00' },
      '3': { enabled: true, start: '10:00', end: '19:00' },
      '4': { enabled: true, start: '10:00', end: '19:00' },
      '5': { enabled: false, start: '07:00', end: '20:00' },
      '6': { enabled: false, start: '07:00', end: '20:00' },
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${FITSHIFT_API}/api/bootstrap`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Bootstrap API error:', error);
    // Fall through to defaults
  }

  // Return minimal defaults if service unavailable
  return NextResponse.json(DEFAULT_BOOTSTRAP);
}
