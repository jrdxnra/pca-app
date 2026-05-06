import { NextRequest, NextResponse } from 'next/server';

const FITSHIFT_API = process.env.FITSHIFT_API_URL || 'https://pca-planner-service-PLACEHOLDER.us-central1.run.app';

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
    showWeekends: true,
    businessHoursWeek: ['09:00 AM', '05:00 PM'],
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
