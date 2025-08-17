// routes/wallet.js
const express = require("express");
const router = express.Router();
const Wallet = require("../models/Wallet");
const UserSettings = require("../models/UserSettings");

function authMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthenticated" });
  next();
}

// GET /api/wallet/summary?currency=USD
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const prefCurrency = (req.query.currency || "USD").toUpperCase();
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id });
    }

    // Get settings (free seconds left etc.) - simplified example:
    const settings = await UserSettings.findOne({ user: req.user._id });
    const freeSec = (req.user.freeCallState && typeof req.user.freeCallState.freeSecondsLeft === "number")
      ? req.user.freeCallState.freeSecondsLeft : 60;

    // Convert USD balance to requested currency using backend FX service
    // For now return usdApprox = wallet.balanceUsd, client can use display pref
    res.json({
      balance: wallet.balanceUsd, // wallet stored in USD
      currency: "USD",
      usdApprox: wallet.balanceUsd,
      freeSecondsLeft: freeSec,
      lowBalanceThresholdUsd: wallet.lowBalanceThresholdUsd || (settings?.lowBalanceThresholdUsd || 1),
      history: wallet.transactions.slice().reverse().slice(0, 50)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;