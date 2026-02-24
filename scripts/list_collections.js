const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function listAll() {
    const list = await db.listCollections();
    console.log('--- All Collections ---');
    for (const c of list) {
        const snap = await c.limit(1).get();
        console.log(`${c.id}: ${snap.empty ? 'EMPTY' : 'HAS DATA'}`);
    }
}

listAll().catch(console.error);
