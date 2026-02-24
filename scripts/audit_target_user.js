const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();
const TARGET_UID = 'DuRPTA63JJOicaDVeF69XhpkTNh2';

async function auditData() {
    console.log(`--- Auditing for UID: ${TARGET_UID} ---`);

    // 1. Check Memberships
    const membershipsSnap = await db.collection('memberships').where('userId', '==', TARGET_UID).get();
    if (membershipsSnap.empty) {
        console.log('No memberships found for this user.');
    } else {
        membershipsSnap.forEach(doc => {
            console.log(`Membership ID: ${doc.id}`, doc.data());
        });
    }

    // 2. Check Clients (User says these load)
    const clientsSnap = await db.collection('clients').limit(5).get();
    console.log('\n--- Sample Clients ---');
    clientsSnap.forEach(doc => {
        console.log(`Client ID: ${doc.id}, ownerId: ${doc.data().ownerId}`);
    });

    // 3. Check Movements (User says these fail)
    const movementsSnap = await db.collection('movements').limit(5).get();
    console.log('\n--- Sample Movements ---');
    movementsSnap.forEach(doc => {
        console.log(`Movement ID: ${doc.id}, ownerId: ${doc.data().ownerId}`);
    });

    // 4. Check Movement Categories
    const catSnap = await db.collection('movement-categories').limit(5).get();
    console.log('\n--- Sample Categories ---');
    catSnap.forEach(doc => {
        console.log(`Category ID: ${doc.id}, ownerId: ${doc.data().ownerId}`);
    });
}

auditData().catch(console.error);
