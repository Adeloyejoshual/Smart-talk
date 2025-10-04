// server/utils/authMiddleware.js
import admin from "firebase-admin";

/**
 * Expects Authorization: Bearer <firebase-id-token>
 * Verifies and attaches `req.user = { uid, email, ... }`
 */
export async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return res.status(401).json({ message: "No token provided" });

    const idToken = match[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error("Token verify error:", err.message || err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

/** Admin-only simple check using OWNER_EMAIL or uid check */
export function requireOwner(req, res, next) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!req.user) return res.status(401).json({ message: "No user" });
  if (req.user.email === ownerEmail || req.user.uid === process.env.OWNER_UID) {
    return next();
  }
  return res.status(403).json({ message: "Admin only" });
}
