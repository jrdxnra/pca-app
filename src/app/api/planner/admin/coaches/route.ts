import { NextRequest, NextResponse } from 'next/server';

const FITSHIFT_API = process.env.FITSHIFT_API_URL || 'http://localhost:4173';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${FITSHIFT_API}/api/admin/coaches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to create coach' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create coach API error:', error);
    return NextResponse.json(
      { error: 'Failed to create coach' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coach_id');

    if (!coachId) {
      return NextResponse.json(
        { error: 'Coach ID required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${FITSHIFT_API}/api/admin/coaches/${coachId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete coach' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete coach API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete coach' },
      { status: 500 }
    );
  }
}
