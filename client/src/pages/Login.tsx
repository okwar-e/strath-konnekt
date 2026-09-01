import { useEffect, useState } from "react";
import {
  EMAIL_FOR_SIGN_IN_KEY,
  completeLoginWithLink,
  isLoginLink,
  sendLoginLink,
} from "../lib/firebase";
import { isStrathmoreEmail } from "../lib/validators";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [completingLink, setCompletingLink] = useState(() =>
    isLoginLink(window.location.href)
  );

  // Handle returning from the emailed sign-in link.
  useEffect(() => {
    if (!completingLink) return;
    const url = window.location.href;

    async function completeSignIn() {
      let storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      if (!storedEmail) {
        storedEmail = window.prompt("Please confirm your email for sign-in") ?? "";
      }

      if (!storedEmail || !isStrathmoreEmail(storedEmail)) {
        throw new Error("invalid-email");
      }

      await completeLoginWithLink(storedEmail, url);
    }

    completeSignIn()
      .catch((err: unknown) => {
        setError(
          err instanceof Error && err.message === "invalid-email"
            ? "Only @strathmore.edu emails are allowed."
            : "This sign-in link is invalid or has expired."
        );
      })
      .finally(() => {
        setCompletingLink(false);
      });
  }, [completingLink]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isStrathmoreEmail(email)) {
      setError("Only @strathmore.edu emails are allowed.");
      return;
    }

    setLoading(true);
    try {
      await sendLoginLink(email);
      setLinkSent(true);
    } catch {
      setError("Failed to send sign-in link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (completingLink) {
    return (
      <div className="page">
        <h1>Strath Konnekt</h1>
        <p>Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Strath Konnekt</h1>
      <p>Verify your Strathmore student email to continue.</p>

      {linkSent ? (
        <p>Check your inbox at {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="you@strathmore.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Continue"}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
