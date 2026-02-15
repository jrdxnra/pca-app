import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const secretKey = request.nextUrl.searchParams.get('key');
    if (secretKey !== 'migrate-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const movementsRef = db.collection('movements');
        const snapshot = await movementsRef.get();

        let updatedCount = 0;
        const batch = db.batch();
        let batchCount = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const config = data.configuration;

            if (!config) return;

            const newConfig: any = { ...config };
            let hasChanges = false;

            // Map snake_case to camelCase
            const mappings: Record<string, string> = {
                'use_reps': 'useReps',
                'use_tempo': 'useTempo',
                'use_time': 'useTime',
                'use_weight': 'useWeight',
                'weight_measure': 'weightMeasure',
                'use_distance': 'useDistance',
                'distance_measure': 'distanceMeasure',
                'use_pace': 'usePace',
                'pace_measure': 'paceMeasure',
                'use_percentage': 'usePercentage',
                'use_rpe': 'useRPE'
            };

            for (const [snake, camel] of Object.entries(mappings)) {
                if (newConfig[snake] !== undefined) {
                    if (newConfig[camel] === undefined) {
                        newConfig[camel] = newConfig[snake];
                        hasChanges = true;
                    }
                    // We can delete the snake_case key to clean up, 
                    // or keep it for backward compatibility if other systems read it.
                    // User said "migrate everything to camel", implying cleanup.
                    delete newConfig[snake];
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                batch.update(doc.ref, { configuration: newConfig });
                batchCount++;
                updatedCount++;
            }
        });

        if (batchCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            message: `Migration complete. Updated ${updatedCount} movements.`,
            updatedCount
        });

    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 });
    }
}
