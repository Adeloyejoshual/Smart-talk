const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const User = require("../models/User");
const Wallet = require("../models/Wallet");

// POST /api/auth/sync
// After frontend login via Firebase, frontend sends token here.
router.post("/sync", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decoded;

    // Check or create user in MongoDB
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.create({
        uid,
        email,
        displayName: name || "User",
        photoURL: picture || "",
      });

      // Create wallet automatically
      await Wallet.create({
        userId: uid,
        balance: 5.0, // default $5
      });
    }

    res.json({ message: "User synced successfully", user });
  } catch (err) {
    console.error("Auth Sync Error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

module.exports = router;