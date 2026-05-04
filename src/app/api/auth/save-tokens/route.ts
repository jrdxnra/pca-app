import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    // Deprecated: calendar tokens are now obtained via /api/auth/google callback flow.
    // Keep this endpoint as a no-op for backward compatibility with older clients.
    try {
        const body = await request.json().catch(() => ({}));
        const hasLegacyPayload = Boolean(body?.accessToken || body?.refreshToken || body?.idToken);

        if (hasLegacyPayload) {
            console.warn('[SaveTokens] Deprecated endpoint called. Ignoring legacy token payload.');
        }

        return NextResponse.json({
            success: true,
            deprecated: true,
            message: 'save-tokens is deprecated; use /api/auth/google connect flow instead.'
        });
    } catch (error) {
        console.error('Deprecated save-tokens endpoint error:', error);
        return NextResponse.json({
            success: true,
            deprecated: true,
            message: 'save-tokens is deprecated; request ignored.'
        });
    }
}
