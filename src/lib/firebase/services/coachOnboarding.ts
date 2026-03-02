import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { auth, getDb } from '@/lib/firebase/config';

export type CoachOnboardingStep = 'calendar' | 'clients';

export interface CoachOnboardingStatus {
  calendarComplete: boolean;
  clientsComplete: boolean;
  updatedAt?: Timestamp;
}

const DEFAULT_STATUS: CoachOnboardingStatus = {
  calendarComplete: false,
  clientsComplete: false,
};

const getOnboardingDocRef = (uid: string) => doc(getDb(), 'users', uid, 'appState', 'setupHub');
async function requireAuthUser(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return await new Promise<User>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Authentication timeout'));
    }, 5000);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        reject(new Error('Not authenticated'));
      }
    });
  });
}

export async function getCoachOnboardingStatus(): Promise<CoachOnboardingStatus> {
  const user = await requireAuthUser();
  const docRef = getOnboardingDocRef(user.uid);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return DEFAULT_STATUS;
  }

  const data = snap.data() as Partial<CoachOnboardingStatus>;
  return {
    ...DEFAULT_STATUS,
    ...data,
  };
}

export async function completeCoachOnboardingStep(step: CoachOnboardingStep): Promise<void> {
  const user = await requireAuthUser();
  const docRef = getOnboardingDocRef(user.uid);

  const payload: Partial<CoachOnboardingStatus> =
    step === 'calendar'
      ? { calendarComplete: true }
      : { clientsComplete: true };

  await setDoc(
    docRef,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
