
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

// Search users by username or email
router.get('/search', verifyToken, async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('username email _id');
    res.json(users);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user list (excluding current user)
router.get('/list', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select('username email _id');
    res.json(users);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add friend route
router.post('/add-friend', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { userId: friendId } = req.body;

  if (!friendId || friendId === userId) {
    return res.status(400).json({ message: "Invalid friend ID" });
  }

  try {
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.friends?.includes(friendId)) {
      return res.status(400).json({ message: "Already added as friend" });
    }

    // Add each other as friends
    user.friends = [...(user.friends || []), friendId];
    friend.friends = [...(friend.friends || []), userId];

    await user.save();
    await friend.save();

    res.json({ message: `You added ${friend.username} as a friend.` });
  } catch (err) {
    console.error('Add Friend Error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;