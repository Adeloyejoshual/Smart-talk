// routes/user.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Search users (by username or email)
router.get("/", async (req, res) => {
  const { search, current } = req.query;

  try {
    const users = await User.find({
      $and: [
        {
          $or: [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
          ]
        },
        { username: { $ne: current } } // Don't show current user
      ]
    }).select("-password");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add friend
router.post("/add", async (req, res) => {
  const { currentUserId, targetUserId } = req.body;

  if (!currentUserId || !targetUserId) {
    return res.status(400).json({ message: "Missing user IDs" });
  }

  try {
    const user = await User.findById(currentUserId);
    const target = await User.findById(targetUserId);

    if (!user || !target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.friends.includes(targetUserId)) {
      user.friends.push(targetUserId);
      await user.save();
    }

    res.json({ message: "Friend added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add friend" });
  }
});

module.exports = router;