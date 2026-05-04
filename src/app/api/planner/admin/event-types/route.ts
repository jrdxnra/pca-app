import { NextRequest, NextResponse } from 'next/server';

const FITSHIFT_API = process.env.FITSHIFT_API_URL || 'http://localhost:4173';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${FITSHIFT_API}/api/admin/event-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to create event type' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create event type API error:', error);
    return NextResponse.json(
      { error: 'Failed to create event type' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventTypeId = searchParams.get('event_type_id');

    if (!eventTypeId) {
      return NextResponse.json(
        { error: 'Event type ID required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${FITSHIFT_API}/api/admin/event-types/${eventTypeId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete event type' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event type API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event type' },
      { status: 500 }
    );
  }
}
