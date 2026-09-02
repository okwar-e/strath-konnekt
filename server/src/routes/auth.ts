import { Router } from "express";
import { prisma } from "../prisma";
import { requireFirebaseAuth, AuthedRequest } from "../middleware/auth";
import { firebaseAuth } from "../firebaseAdmin";
import { sendLoginLinkEmail } from "../mailer";

const router = Router();
const ALLOWED_DOMAIN = "@strathmore.edu";

// Generates the sign-in link via Firebase Admin (no client-side Firebase mailer
// involved) and delivers it ourselves — avoids Firebase's own email-sign-in quota.
router.post("/send-link", async (req, res) => {
  const email = (req.body?.email ?? "").toLowerCase().trim();

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(403).json({ error: "Only @strathmore.edu emails are allowed" });
  }

  try {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const link = await firebaseAuth().generateSignInWithEmailLink(email, {
      url: `${clientUrl}/login`,
      handleCodeInApp: true,
    });

    await sendLoginLinkEmail(email, link);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to send login link", err);
    res.status(500).json({ error: "Failed to send sign-in link" });
  }
});

router.post("/sync", requireFirebaseAuth, async (req: AuthedRequest, res) => {
  const email = req.firebaseEmail!.toLowerCase();
  const firebaseUid = req.firebaseUid!;

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(403).json({ error: "Only @strathmore.edu emails are allowed" });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // No name/gender collected yet — chats are anonymous until onboarding (Sprint 3+).
    user = await prisma.user.create({
      data: {
        email,
        firebaseUid,
        firstName: null,
        gender: "PREFER_NOT_TO_SAY",
        verified: true,
        banned: false,
        strikeCount: 0,
      },
    });
  }

  if (user.banned) {
    return res.status(403).json({ message: "Account suspended." });
  }

  res.json(user);
});

export default router;
