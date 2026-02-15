const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'performancecoachapp-26bd1'
    });
}

const db = admin.firestore();

async function bootstrapAccounts() {
    const MASTER_ID = 'DuRPTA63JJOicaDVeF69XhpkTNh2';
    const OTHER_USER = 'ZKXqliw1QvSMw1DOdZpJdSpMfr73';

    console.log('--- Bootstrapping Accounts & Memberships ---');

    // 1. Create Master Account
    const masterAccountRef = db.collection('accounts').doc('master');
    await masterAccountRef.set({
        name: 'Master Template Account',
        ownerId: MASTER_ID,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Created Master Account');

    // 2. Create Memberships
    await db.collection('memberships').doc(`m-${MASTER_ID}`).set({
        userId: MASTER_ID,
        accountId: 'master',
        role: 'owner',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Linked ${MASTER_ID} to Master Account`);

    // 3. Create Account for Other User (if they exist)
    const userAccountRef = db.collection('accounts').doc(`acc-${OTHER_USER}`);
    await userAccountRef.set({
        name: 'User Account',
        ownerId: OTHER_USER,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('memberships').doc(`m-${OTHER_USER}`).set({
        userId: OTHER_USER,
        accountId: `acc-${OTHER_USER}`,
        role: 'owner',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Linked ${OTHER_USER} to its own account`);

    // 4. Any orphaned data in Config Library? Patch them to Master for now so they are cloneable
    const configCollections = ['workoutTypes', 'workoutCategories', 'periods'];
    for (const coll of configCollections) {
        const snapshot = await db.collection(coll).get();
        for (const doc of snapshot.docs) {
            if (!doc.data().ownerId) {
                await doc.ref.update({ ownerId: 'master' });
                console.log(`Patched ${coll} doc ${doc.id} to master account`);
            }
        }
    }
}

bootstrapAccounts().catch(console.error);
