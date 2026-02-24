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
    // Standardize IDs: accountId_userId
    const masterMembershipId = `master_${MASTER_ID}`;
    await db.collection('memberships').doc(masterMembershipId).set({
        userId: MASTER_ID,
        accountId: 'master',
        role: 'owner',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Linked ${MASTER_ID} to Master Account with ID ${masterMembershipId}`);

    // Clean up old membership ID if it exists
    await db.collection('memberships').doc(`m-${MASTER_ID}`).delete();

    // 3. Create Account for Other User (if they exist)
    const userAccountId = `acc-${OTHER_USER}`;
    const userAccountRef = db.collection('accounts').doc(userAccountId);
    await userAccountRef.set({
        name: 'User Account',
        ownerId: OTHER_USER,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const userMembershipId = `${userAccountId}_${OTHER_USER}`;
    await db.collection('memberships').doc(userMembershipId).set({
        userId: OTHER_USER,
        accountId: userAccountId,
        role: 'owner',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Linked ${OTHER_USER} to its own account with ID ${userMembershipId}`);

    // Clean up old membership ID if it exists
    await db.collection('memberships').doc(`m-${OTHER_USER}`).delete();

    // 4. Handle Configuration Siloing
    const oldConfigRef = db.collection('configuration').doc('calendar-config');
    const oldConfigSnap = await oldConfigRef.get();
    if (oldConfigSnap.exists) {
        const data = oldConfigSnap.data();
        await db.collection('configuration').doc('calendar-config-master').set({
            ...data,
            ownerId: 'master',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Migrated calendar-config to calendar-config-master');
    }

    // 5. Generic Membership Migration
    console.log('Checking for legacy membership IDs...');
    const membershipSnapshot = await db.collection('memberships').get();
    let migratedCount = 0;
    for (const doc of membershipSnapshot.docs) {
        const data = doc.data();
        const correctId = `${data.accountId}_${data.userId}`;

        if (doc.id !== correctId) {
            console.log(`Migrating membership ${doc.id} -> ${correctId}`);
            await db.collection('memberships').doc(correctId).set({
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await doc.ref.delete();
            migratedCount++;
        }
    }
    console.log(`Migrated ${migratedCount} memberships to the new ID format.`);

    // 6. Generic Data Migration (UID -> AccountId)
    // Build a map of userId -> accountId
    console.log('Building userId to accountId map...');
    const userToAccountMap = {};
    for (const doc of membershipSnapshot.docs) {
        const data = doc.data();
        userToAccountMap[data.userId] = data.accountId;
    }

    const configCollections = [
        'workoutTypes',
        'workoutCategories',
        'periods',
        'movements',
        'movement-categories',
        'programs',
        'workouts',
        'clients',
        'clientWorkouts',
        'configuration',
        'weekTemplates',
        'workoutStructureTemplates',
        'client-programs',
        'workoutLogs'
    ];

    for (const coll of configCollections) {
        console.log(`Checking ${coll}...`);
        const snapshot = await db.collection(coll).get();
        let masterCount = 0;
        let mappedCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // 1. If it's owned by the specific Master UID, move it to 'master'
            if (data.ownerId === MASTER_ID) {
                await doc.ref.update({ ownerId: 'master' });
                masterCount++;
            }
            // 2. If ownerId is a legacy UID that exists in our membership map, map it to accountId
            else if (userToAccountMap[data.ownerId]) {
                const targetAccountId = userToAccountMap[data.ownerId];
                if (data.ownerId !== targetAccountId) {
                    console.log(`Mapping ${coll}/${doc.id}: ${data.ownerId} -> ${targetAccountId}`);
                    await doc.ref.update({ ownerId: targetAccountId });
                    mappedCount++;
                }
            }
            // 3. Fallback: if no ownerId at all, assign to master
            else if (!data.ownerId) {
                await doc.ref.update({ ownerId: 'master' });
                masterCount++;
            }
        }
        console.log(`Finished ${coll}: ${masterCount} patched to master, ${mappedCount} mapped to accountId`);
    }
}

bootstrapAccounts().catch(console.error);
