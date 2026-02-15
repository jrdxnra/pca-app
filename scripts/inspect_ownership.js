const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Try default first
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function inspectData() {
    const collections = [
        'movements',
        'workoutTypes',
        'workoutCategories',
        'periods',
        'clients',
        'programs'
    ];

    for (const collName of collections) {
        console.log(`\n--- Collection: ${collName} ---`);
        const snapshot = await db.collection(collName).limit(5).get();
        if (snapshot.empty) {
            console.log('Empty collection');
            continue;
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`Doc ID: ${doc.id}, Name: ${data.name}, OwnerId: ${data.ownerId || 'MISSING'}`);
        });

        // Count by ownerId
        const allDocs = await db.collection(collName).get();
        const counts = {};
        allDocs.docs.forEach(doc => {
            const ownerId = doc.data().ownerId || 'MISSING';
            counts[ownerId] = (counts[ownerId] || 0) + 1;
        });
        console.log('Counts by OwnerId:', counts);
    }
}

inspectData().catch(console.error);
