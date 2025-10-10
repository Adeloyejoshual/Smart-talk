// routes/wallet.js
import express from "express";
const router = express.Router();
import User from "../models/User.js";

// 🔹 Get Wallet Balance
router.get("/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, balance: user.walletBalance || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔹 Add Funds
router.post("/add", async (req, res) => {
  try {
    const { uid, amount } = req.body;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.walletBalance = (user.walletBalance || 0) + Number(amount);
    await user.save();

    res.json({ success: true, balance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; // ✅ REQUIRED for import walletRoutes from "./routes/wallet.js";