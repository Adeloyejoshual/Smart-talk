const admin = require("firebase-admin");

module.exports = async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split("Bearer ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};