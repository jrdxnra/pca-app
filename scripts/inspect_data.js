const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function inspect() {
    const collections = [
        'clients',
        'movements',
        'movement-categories',
        'workoutStructureTemplates',
        'weekTemplates',
        'configuration'
    ];

    for (const coll of collections) {
        console.log(`\n--- Inspecting ${coll} ---`);
        const snap = await db.collection(coll).limit(10).get();
        if (snap.empty) {
            console.log(`   Collection ${coll} is EMPTY.`);
            continue;
        }
        console.log(`   Found ${snap.size} sample documents.`);
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`   ID: ${doc.id} | ownerId: ${data.ownerId || 'MISSING'}${data.name ? ' | name: ' + data.name : ''}${data.title ? ' | title: ' + data.title : ''}`);
        });
    }
}

inspect().catch(console.error);
