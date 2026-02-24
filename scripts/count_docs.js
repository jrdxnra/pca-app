const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function countAll() {
    const colls = [
        'movements',
        'movement-categories',
        'workoutStructureTemplates',
        'weekTemplates',
        'workoutCategories',
        'workoutTypes',
        'clients',
        'workouts',
        'clientWorkouts',
        'workoutLogs'
    ];

    for (const c of colls) {
        const snap = await db.collection(c).get();
        console.log(`${c}: ${snap.size} documents`);
    }
}

countAll().catch(console.error);
