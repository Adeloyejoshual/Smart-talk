// routes/user.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

// ✅ Get user profile by UID
router.get("/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Create or update user
router.post("/", async (req, res) => {
  try {
    const { uid, name, email, photo } = req.body;

    let user = await User.findOne({ uid });
    if (user) {
      user.name = name || user.name;
      user.email = email || user.email;
      user.photo = photo || user.photo;
      await user.save();
    } else {
      user = await User.create({ uid, name, email, photo, walletBalance: 0 });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;