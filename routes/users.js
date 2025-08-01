// routes/user.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Search users by username or email
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// List all users
router.get("/list", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update username
router.put("/update-username", async (req, res) => {
  const { userId, newUsername } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { username: newUsername },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Username updated", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update username" });
  }
});

module.exports = router;