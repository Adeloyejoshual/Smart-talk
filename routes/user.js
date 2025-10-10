// routes/user.js
import express from "express";
const router = express.Router();
import User from "../models/User.js";

// Example route
router.post("/register", async (req, res) => {
  try {
    const { uid, email } = req.body;
    let user = await User.findOne({ uid });

    if (!user) {
      user = new User({ uid, email, walletBalance: 0 });
      await user.save();
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;