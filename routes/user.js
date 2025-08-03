const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const authenticateToken = require("../middleware/auth");

// 🔒 Get current user data (including friends)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friends", "username email");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to load user." });
  }
});

// 📥 Search users by username or email
router.get("/search", authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: "Missing query." });

  try {
    const regex = new RegExp(q, "i");
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }],
      _id: { $ne: req.user._id },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed." });
  }
});

// ➕ Add friend
router.post("/add-friend/:id", authenticateToken, async (req, res) => {
  const friendId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    return res.status(400).json({ message: "Invalid friend ID." });
  }

  try {
    const user = await User.findById(req.user._id);
    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ message: "User not found." });

    if (!user.friends.includes(friendId)) {
      user.friends.push(friendId);
      await user.save();
    }

    if (!friend.friends.includes(req.user._id)) {
      friend.friends.push(req.user._id);
      await friend.save();
    }

    res.json({ message: "Friend added." });
  } catch (err) {
    res.status(500).json({ message: "Failed to add friend." });
  }
});

// ➖ Remove friend
router.post("/remove-friend/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID." });
  }

  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: id } });
    await User.findByIdAndUpdate(id, { $pull: { friends: req.user._id } });

    res.json({ message: "Friend removed." });
  } catch (err) {
    res.status(500).json({ message: "Error removing friend." });
  }
});

// 👥 Get friends only
router.get("/friends", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friends", "username email");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Failed to load friends." });
  }
});

module.exports = router;