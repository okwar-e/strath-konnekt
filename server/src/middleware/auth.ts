import { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../firebaseAdmin";

export interface AuthedRequest extends Request {
  firebaseEmail?: string;
  firebaseUid?: string;
}

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>".
// Never trust an email/identity supplied directly by the client body/query.
export async function requireFirebaseAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const idToken = authHeader.slice("Bearer ".length);

  try {
    const decoded = await firebaseAuth().verifyIdToken(idToken);

    if (!decoded.email) {
      return res.status(401).json({ error: "Token does not contain an email" });
    }

    req.firebaseEmail = decoded.email;
    req.firebaseUid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
