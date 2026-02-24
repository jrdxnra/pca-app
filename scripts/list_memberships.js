const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function listMemberships() {
    console.log('--- All Memberships ---');
    const snapshot = await db.collection('memberships').get();
    if (snapshot.empty) {
        console.log('No membership documents found!');
    } else {
        snapshot.forEach(doc => {
            console.log(`ID: ${doc.id}`, doc.data());
        });
    }
}

listMemberships().catch(console.error);
