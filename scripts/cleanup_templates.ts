
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!serviceAccount.project_id) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY not found or invalid');
    process.exit(1);
}

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function listAndDeleteTemplates() {
    const snapshot = await db.collection('workout-templates').get();
    const templates = [];

    console.log('Found', snapshot.size, 'templates.');

    for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Name: ${data.name}`);
        if (data.name === 'Test' || data.name === 'Test (Copy)') {
            console.log(`Deleting template: ${data.name} (${doc.id})`);
            await db.collection('workout-templates').doc(doc.id).delete();
        }
    }
}

listAndDeleteTemplates().catch(console.error);
