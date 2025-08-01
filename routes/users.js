const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search users by username or email
router.get('/search', async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (for list display)
router.get('/list', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Update username
router.post('/update-username', async (req, res) => {
  const { userId, newUsername } = req.body;
  try {
    const existing = await User.findOne({ username: newUsername });
    if (existing) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = await User.findByIdAndUpdate(userId, { username: newUsername }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Username updated successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating username' });
  }
});

module.exports = router;