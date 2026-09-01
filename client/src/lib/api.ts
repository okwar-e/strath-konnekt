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
