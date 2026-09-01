import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import { syncUser, type SyncedUser } from "./api";
import { AuthContext } from "./authContextBase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<SyncedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      setError(null);

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const syncedUser = await syncUser(idToken);
        setUser(syncedUser);
      } catch {
        setError("Failed to sync your account with the server.");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
