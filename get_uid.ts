import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './src/lib/firebase/config';

async function main() {
  const db = getDb();
  const snapshot = await getDocs(collection(db, 'clients'));
  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    console.log('Found UID in clients:', data.createdBy);
  } else {
    console.log('No clients found');
  }
}
main();
