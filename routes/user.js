const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticateToken = require("../middleware/auth");
const mongoose = require("mongoose");

// GET current user info (for refresh)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friends", "username email");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to load user." });
  }
});

// GET all users except current and blocked ones
router.get("/list", authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to load users." });
  }
});

// ✅ NEW: Get only friends
router.get("/friends", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friends", "username email");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Failed to load friends." });
  }
});

// ✅ Add friend
router.post("/add-friend", authenticateToken, async (req, res) => {
  const { friendId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    return res.status(400).json({ message: "Invalid friend ID format." });
  }

  try {
    const currentUser = await User.findById(req.user._id);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ message: "User not found." });
    }

    // Add each other as friends
    if (!currentUser.friends.includes(friendId)) {
      currentUser.friends.push(friendId);
      await currentUser.save();
    }

    if (!friend.friends.includes(req.user._id)) {
      friend.friends.push(req.user._id);
      await friend.save();
    }

    res.json({ message: "Friend added." });
  } catch (err) {
    res.status(500).json({ message: "Error adding friend." });
  }
});

// ✅ NEW: Remove friend
router.post("/remove-friend/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: id } });
    await User.findByIdAndUpdate(id, { $pull: { friends: req.user._id } });

    res.json({ message: "Friend removed." });
  } catch (err) {
    res.status(500).json({ message: "Error removing friend." });
  }
});

module.exports = router;