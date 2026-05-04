import { NextRequest, NextResponse } from 'next/server';

const FITSHIFT_API = process.env.FITSHIFT_API_URL || 'http://localhost:4173';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${FITSHIFT_API}/api/admin/calendars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to create calendar' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create calendar API error:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendar_id');

    if (!calendarId) {
      return NextResponse.json(
        { error: 'Calendar ID required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${FITSHIFT_API}/api/admin/calendars/${calendarId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete calendar' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete calendar API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar' },
      { status: 500 }
    );
  }
}
