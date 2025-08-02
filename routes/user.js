// routes/user.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");

    
// POST: Search for users
router.post("/search", authenticateToken, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ message: "No search query." });

  try {
    const regex = new RegExp(query, "i"); // case-insensitive
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }],
      _id: { $ne: req.user._id },
    }).select("username email");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed." });
  }
});

// POST: Add Friend
router.post("/add-friend", authenticateToken, async (req, res) => {
  const { friendId } = req.body;

  try {
    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ message: "Invalid friend." });

    // Prevent duplicates
    if (req.user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Friend already added." });
    }

    // Add each other as friends
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $addToSet: { friends: req.user._id } });

    res.json({ message: "Friend added successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error adding friend." });
  }
});

module.exports = router;