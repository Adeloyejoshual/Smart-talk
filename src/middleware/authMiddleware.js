import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
