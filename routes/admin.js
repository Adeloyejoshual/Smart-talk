// routes/admin.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

// ✅ GET /api/admin/users - View all users
router.get("/users", verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PATCH /api/admin/ban/:userId - Ban or unban user
router.patch("/ban/:userId", verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Admins only." });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.banned = !user.banned;
    await user.save();

    res.json({
      message: user.banned ? "User has been banned" : "User has been unbanned"
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;