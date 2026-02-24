const admin = require('firebase-admin');

// Using the hardcoded project ID found in admin.ts
const projectId = 'performancecoachapp-26bd1';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
    });
}

const db = admin.firestore();

async function deepInspect() {
    const collections = [
        'movements',
        'movement-categories',
        'workoutStructureTemplates',
        'weekTemplates',
        'workoutCategories',
        'workoutTypes'
    ];

    console.log(`--- Deep Inspection of Project: ${projectId} ---`);

    for (const collName of collections) {
        console.log(`\nChecking collection: ${collName}`);
        try {
            const snapshot = await db.collection(collName).get();
            if (snapshot.empty) {
                console.log(`  - No documents found in ${collName}.`);
                continue;
            }

            console.log(`  - Found ${snapshot.size} documents.`);

            const stats = {};
            snapshot.docs.forEach(doc => {
                const ownerId = doc.data().ownerId || 'MISSING';
                stats[ownerId] = (stats[ownerId] || 0) + 1;
            });

            console.log('  - ownerId Distribution:', stats);

            // Show first 3 docs for each ownerId
            const sampleOwners = Object.keys(stats);
            for (const owner of sampleOwners) {
                console.log(`  - Samples for ownerId: ${owner}`);
                const samples = snapshot.docs.filter(d => (d.data().ownerId || 'MISSING') === owner).slice(0, 3);
                samples.forEach(s => {
                    const data = s.data();
                    console.log(`    - [${s.id}] name/title: ${data.name || data.title || 'N/A'}`);
                });
            }

        } catch (e) {
            console.error(`  - Error accessing ${collName}:`, e.message);
        }
    }
}

deepInspect().catch(console.error);
