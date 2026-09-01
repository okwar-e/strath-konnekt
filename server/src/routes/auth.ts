import { Router } from "express";
import { prisma } from "../prisma";
import { requireFirebaseAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
const ALLOWED_DOMAIN = "@strathmore.edu";

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
