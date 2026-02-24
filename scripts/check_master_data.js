const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();
const MASTER_UID = 'DuRPTA63JJOicaDVeF69XhpkTNh2';
const MASTER_ACCOUNT_ID = 'master';

async function diagnose() {
    console.log('--- Diagnostic Report ---');

    // 1. Check Master Membership
    const membershipId = `${MASTER_ACCOUNT_ID}_${MASTER_UID}`;
    const membershipDoc = await db.collection('memberships').doc(membershipId).get();

    if (membershipDoc.exists) {
        console.log('✅ Master Membership exists:', membershipDoc.data());
    } else {
        console.log('❌ Master Membership MISSING! ID:', membershipId);
        // Let's check any membership for this user
        const userMemberships = await db.collection('memberships').where('userId', '==', MASTER_UID).get();
        if (userMemberships.empty) {
            console.log('   No memberships found for this user UID.');
        } else {
            userMemberships.forEach(doc => {
                console.log('   Found other membership:', doc.id, doc.data());
            });
        }
    }

    // 2. Check Data in key collections
    const collections = [
        'movement-categories',
        'movements',
        'workoutStructureTemplates',
        'weekTemplates',
        'configuration'
    ];

    for (const collName of collections) {
        console.log(`\n--- Collection: ${collName} ---`);
        const snap = await db.collection(collName).where('ownerId', '==', MASTER_ACCOUNT_ID).limit(5).get();
        if (snap.empty) {
            console.log(`   No documents found with ownerId == "master"`);
            // Check if there is ANY data
            const anySnap = await db.collection(collName).limit(3).get();
            if (anySnap.empty) {
                console.log('   Collection is completely EMPTY.');
            } else {
                console.log('   Sample documents (no master ownerId):');
                anySnap.forEach(doc => {
                    console.log(`     ID: ${doc.id}, ownerId: ${doc.data().ownerId}`);
                });
            }
        } else {
            console.log(`   Found ${snap.size} documents with ownerId == "master"`);
            snap.forEach(doc => {
                console.log(`     ✅ ID: ${doc.id}`);
            });
        }
    }
}

diagnose().catch(console.error);
