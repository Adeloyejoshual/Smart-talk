// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

// 🔍 Search users by username or email
router.get('/search', verifyToken, async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('username email');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error during search' });
  }
});

// ➕ Add a friend
router.post('/add-friend', verifyToken, async (req, res) => {
  const { friendId } = req.body;
  const userId = req.userId;

  if (!friendId) {
    return res.status(400).json({ message: 'Friend ID is required' });
  }

  try {
    if (friendId === userId) {
      return res.status(400).json({ message: "You can't add yourself" });
    }

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!friend) return res.status(404).json({ message: 'User not found' });

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: 'Already added' });
    }

    user.friends.push(friendId);
    await user.save();

    res.json({ message: 'Friend added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding friend' });
  }
});

module.exports = router;