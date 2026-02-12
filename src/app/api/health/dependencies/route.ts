import { NextResponse } from 'next/server';

export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        service: 'pca-app',
        dependencies: {} as Record<string, { status: string; latency?: number; error?: string }>
    };

    // Check environment variables
    const requiredEnvVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    checks.dependencies.environment = {
        status: missingEnvVars.length === 0 ? 'healthy' : 'degraded',
        ...(missingEnvVars.length > 0 && { error: `Missing env vars: ${missingEnvVars.join(', ')}` })
    };

    // Overall status
    const allHealthy = Object.values(checks.dependencies).every(dep => dep.status === 'healthy');
    const status = allHealthy ? 'healthy' : 'degraded';

    return NextResponse.json(
        { status, ...checks },
        { status: allHealthy ? 200 : 503 }
    );
}
