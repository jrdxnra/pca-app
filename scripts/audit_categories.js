const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function auditCategories() {
    console.log('--- Auditing movement-categories for ownerId: "master" ---');
    const snap = await db.collection('movement-categories')
        .where('ownerId', '==', 'master')
        .get();

    const counts = {};
    snap.forEach(doc => {
        const name = doc.data().name || 'UNTITLED';
        counts[name] = (counts[name] || 0) + 1;
    });

    console.log(JSON.stringify(counts, null, 2));
}

auditCategories().catch(console.error);
