const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function checkMemberships() {
    console.log('--- Memberships ---');
    const snapshot = await db.collection('memberships').get();
    if (snapshot.empty) {
        console.log('No memberships found.');
    } else {
        snapshot.forEach(doc => {
            console.log(`ID: ${doc.id}`, doc.data());
        });
    }

    console.log('\n--- Accounts ---');
    const accountsSnapshot = await db.collection('accounts').get();
    accountsSnapshot.forEach(doc => {
        console.log(`ID: ${doc.id}`, doc.data());
    });
}

checkMemberships().catch(console.error);
