import { createContext, useContext } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import type { SyncedUser } from "./api";

export interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: SyncedUser | null;
  loading: boolean;
  error: string | null;
}

export const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  user: null,
  loading: true,
  error: null,
});

export function useAuth() {
  return useContext(AuthContext);
}
