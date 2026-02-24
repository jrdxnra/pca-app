import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTIONS_TO_BACKFILL = [
    'movements',
    'movement-categories',
    'workoutStructureTemplates',
    'weekTemplates',
    'workoutCategories',
    'workoutTypes',
    'clients',
    'workouts',
    'clientWorkouts',
    'workoutLogs',
    'configuration'
];

export async function GET(request: NextRequest) {
    const secretKey = request.nextUrl.searchParams.get('key');
    if (secretKey !== 'backfill-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const results: Record<string, any> = {};
        let totalUpdated = 0;

        // --- PHASE 1: Standard Backfill (ownerId and order) ---
        for (const collName of COLLECTIONS_TO_BACKFILL) {
            console.log(`[Backfill] Processing collection: ${collName}`);
            const snapshot = await db.collection(collName).get();
            if (snapshot.empty) continue;

            const batch = db.batch();
            let batchCount = 0;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                let needsUpdate = false;
                const updateData: any = {};

                if (!data.ownerId) {
                    updateData.ownerId = 'master';
                    needsUpdate = true;
                }

                if (['movement-categories', 'movements', 'workoutCategories', 'workoutTypes', 'weekTemplates'].includes(collName)) {
                    if (data.order === undefined) {
                        updateData.order = 0;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    batch.update(doc.ref, updateData);
                    batchCount++;
                    totalUpdated++;
                    if (batchCount === 490) {
                        await batch.commit();
                        batchCount = 0;
                    }
                }
            }
            if (batchCount > 0) await batch.commit();
        }

        // --- PHASE 2: Category Consolidation ---
        console.log('[Backfill] Phase 2: Category Consolidation');
        const categoriesSnapshot = await db.collection('movement-categories').where('ownerId', '==', 'master').get();
        const nameToCanonicalId: Record<string, string> = {};
        const loserIds = new Set<string>();

        categoriesSnapshot.forEach(doc => {
            const name = (doc.data().name || '').trim();
            if (!name) return;
            if (!nameToCanonicalId[name]) {
                nameToCanonicalId[name] = doc.id;
            } else {
                loserIds.add(doc.id);
            }
        });

        results.categories_consolidated = {
            totalFound: categoriesSnapshot.size,
            totalDuplicates: loserIds.size,
            canonicalNames: Object.keys(nameToCanonicalId)
        };

        // --- PHASE 3: Movement Relinking ---
        console.log('[Backfill] Phase 3: Movement Relinking');
        const movementsSnapshot = await db.collection('movements').where('ownerId', '==', 'master').get();
        let movementsRelinked = 0;
        const movementBatch = db.batch();
        let mBatchCount = 0;

        for (const mDoc of movementsSnapshot.docs) {
            const mData = mDoc.data();
            const currentCatId = mData.categoryId;

            // If the current category doesn't exist or is a "loser", find the correct one by name
            const currentCatDoc = await db.collection('movement-categories').doc(currentCatId).get();
            if (!currentCatDoc.exists || loserIds.has(currentCatId)) {
                const catName = currentCatDoc.exists ? (currentCatDoc.data()?.name || '').trim() : '';
                // If we don't have a name, we might be lost, but let's try to find if there's any category with the same name
                // (This part is tricky if the category doesn't exist at all).
                // For simplicity, we'll only relink if we can match by name from a loser.
                if (catName && nameToCanonicalId[catName]) {
                    movementBatch.update(mDoc.ref, { categoryId: nameToCanonicalId[catName] });
                    movementsRelinked++;
                    mBatchCount++;
                    if (mBatchCount === 490) {
                        await movementBatch.commit();
                        mBatchCount = 0;
                    }
                }
            }
        }
        if (mBatchCount > 0) await movementBatch.commit();
        results.movementsRelinked = movementsRelinked;

        // --- PHASE 4: Delete Loser Categories ---
        console.log('[Backfill] Phase 4: Cleaning up duplicates');
        const deleteBatch = db.batch();
        let dBatchCount = 0;
        for (const loserId of loserIds) {
            deleteBatch.delete(db.collection('movement-categories').doc(loserId));
            dBatchCount++;
            if (dBatchCount === 490) {
                await deleteBatch.commit();
                dBatchCount = 0;
            }
        }
        if (dBatchCount > 0) await deleteBatch.commit();

        // --- PHASE 5: Fix Location Abbreviations ---
        console.log('[Backfill] Phase 5: Normalizing Location Abbreviations');
        const configSnap = await db.collection('configuration').doc('calendar-config-master').get();
        if (configSnap.exists) {
            const data = configSnap.data();
            if (data?.locationAbbreviations && Array.isArray(data.locationAbbreviations)) {
                const cleaned = data.locationAbbreviations.map((abbr: any) => {
                    if (abbr.original && abbr.ignored === true) {
                        // In the old broken logic, ignored=true meant "show full name".
                        // We want to restore them to "n/a" if they are in the N/A list.
                        return {
                            ...abbr,
                            abbreviation: 'n/a',
                            ignored: false // Treat it as a real abbreviation now
                        };
                    }
                    return abbr;
                });
                await db.collection('configuration').doc('calendar-config-master').update({
                    locationAbbreviations: cleaned
                });
                results.locationsFixed = cleaned.length;
            }
        }

        return NextResponse.json({
            success: true,
            totalUpdated,
            results,
            message: `Successfully consolidated data and restored visibility.`
        });

    } catch (error: any) {
        console.error('[Backfill] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
