import { NextResponse } from 'next/server';
import {
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    doc
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';

const COLLECTIONS = [
    'clients',
    'clientWorkouts',
    'programs',
    'workout-templates',
    'client-programs',
    'workoutStructureTemplates',
    'weekTemplates',
    'movements',
    'movement-categories',
    'workoutLogs',
    'scheduled-workouts'
];

export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const db = getDb();
        const results: Record<string, number> = {};

        for (const collectionName of COLLECTIONS) {
            const q = query(
                collection(db, collectionName)
            );

            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            let count = 0;

            snapshot.docs.forEach((document) => {
                const data = document.data();
                if (!data.ownerId) {
                    batch.update(doc(db, collectionName, document.id), {
                        ownerId: userId
                    });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
            }

            results[collectionName] = count;
        }

        return NextResponse.json({
            message: 'Migration completed successfully',
            details: results
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: 'Migration failed',
            details: error.message
        }, { status: 500 });
    }
}
