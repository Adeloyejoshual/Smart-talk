// routes/settings.js
const express = require("express");
const router = express.Router();
const UserSettings = require("../models/UserSettings");
const Wallet = require("../models/Wallet");

// Placeholder auth middleware: replace with your real one
function authMiddleware(req, res, next) {
  // expecting req.user populated by your auth system
  if (!req.user) return res.status(401).json({ error: "unauthenticated" });
  next();
}

// GET /api/settings
router.get("/", authMiddleware, async (req, res) => {
  try {
    let s = await UserSettings.findOne({ user: req.user._id });
    if (!s) {
      s = await UserSettings.create({ user: req.user._id });
    }
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/settings
router.put("/", authMiddleware, async (req, res) => {
  try {
    const payload = req.body || {};
    const allowed = [
      "darkMode","language","fontSize",
      "notifMessages","notifCalls","dnd","notificationSoundKind","notificationSound",
      "showLastSeen","allowCallsFromEveryone",
      "walletCurrency","lowBalanceThresholdUsd",
      "twoFA"
    ];

    const update = {};
    allowed.forEach(k => { if (k in payload) update[k] = payload[k]; });

    const s = await UserSettings.findOneAndUpdate(
      { user: req.user._id },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;