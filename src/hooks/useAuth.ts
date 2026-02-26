import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
        } catch (error) {
          console.error('Error getting ID token:', error);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }

      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { user, idToken, loading };
}
