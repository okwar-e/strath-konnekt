import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Lazily initialized so the server can still boot (e.g. for /health) before
// real Firebase Admin credentials are configured in .env.
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // .env stores literal "\n" sequences; convert them back to real newlines.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }

  auth = getAuth();
  return auth;
}
