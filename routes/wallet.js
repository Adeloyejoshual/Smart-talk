const express = require("express");
const router = express.Router();
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const verifyFirebaseToken = require("../middleware/authMiddleware");

// ✅ GET /api/wallet/:uid — Fetch balance
router.get("/:uid", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.params;
    let wallet = await Wallet.findOne({ userId: uid });

    // If wallet missing, create one
    if (!wallet) {
      wallet = await Wallet.create({ userId: uid, balance: 0 });
    }

    res.json({ balance: wallet.balance, currency: wallet.currency });
  } catch (err) {
    console.error("Wallet Error:", err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

// ✅ POST /api/wallet/add-credit — Add funds manually
router.post("/add-credit", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount) return res.status(400).json({ error: "Missing fields" });

    const wallet = await Wallet.findOne({ userId: uid });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    wallet.balance += parseFloat(amount);
    await wallet.save();

    res.json({ message: "Credit added", newBalance: wallet.balance });
  } catch (err) {
    console.error("Add Credit Error:", err);
    res.status(500).json({ error: "Failed to add credit" });
  }
});

module.exports = router;