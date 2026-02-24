import { db, auth } from './config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const debugMembership = async () => {
    const user = auth.currentUser;
    if (!user) {
        console.log("No user logged in");
        return;
    }
    console.log("Checking membership for UID:", user.uid);
    const q = query(collection(db, 'memberships'), where('userId', '==', user.uid));
    try {
        const snap = await getDocs(q);
        if (snap.empty) {
            console.log("No memberships found in Firestore");
        } else {
            snap.forEach(doc => {
                console.log("Membership Found:", doc.id, doc.data());
            });
        }
    } catch (error) {
        console.error("Error querying memberships:", error);
    }
}
