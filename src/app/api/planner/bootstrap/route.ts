import { NextRequest, NextResponse } from 'next/server';

const FITSHIFT_API = process.env.FITSHIFT_API_URL || 'http://localhost:4173';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${FITSHIFT_API}/api/bootstrap`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch bootstrap data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Bootstrap API error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to planner service' },
      { status: 500 }
    );
  }
}
