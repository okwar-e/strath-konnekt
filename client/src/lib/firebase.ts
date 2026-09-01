import { initializeApp } from "firebase/app";
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type ActionCodeSettings,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

if (!isFirebaseConfigured) {
  // Avoid crashing the whole app at import time when .env hasn't been filled in yet.
  console.error(
    "Missing Firebase config: set VITE_FIREBASE_* values in client/.env (see .env.example)."
  );
}

const app = initializeApp(
  isFirebaseConfigured ? firebaseConfig : { apiKey: "missing-config", projectId: "missing-config" }
);
export const auth = getAuth(app);

// Key used to remember the email the sign-in link was sent to (per Firebase docs).
export const EMAIL_FOR_SIGN_IN_KEY = "strathkonnekt.emailForSignIn";

const actionCodeSettings: ActionCodeSettings = {
  url: `${window.location.origin}/login`,
  handleCodeInApp: true,
};

export function sendLoginLink(email: string) {
  return sendSignInLinkToEmail(auth, email, actionCodeSettings).then(() => {
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
  });
}

export function isLoginLink(url: string) {
  return isSignInWithEmailLink(auth, url);
}

export function completeLoginWithLink(email: string, url: string) {
  return signInWithEmailLink(auth, email, url).then((result) => {
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    return result;
  });
}
