import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/authContextBase";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) return <div className="page">Loading...</div>;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) return <div className="page">Loading...</div>;
  if (firebaseUser) return <Navigate to="/" replace />;

  return <>{children}</>;
}
