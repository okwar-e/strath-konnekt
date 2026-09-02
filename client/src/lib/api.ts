const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export interface SyncedUser {
  id: string;
  email: string;
  firstName: string | null;
  gender: string;
  verified: boolean;
  banned: boolean;
  strikeCount: number;
  createdAt: string;
}

export async function requestLoginLink(email: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/auth/send-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to send sign-in link");
  }
}

export async function syncUser(idToken: string): Promise<SyncedUser> {
  const res = await fetch(`${SERVER_URL}/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to sync user with server");
  }

  return res.json();
}
