const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Temporary user ID for testing
const tempUserId = 'PUT_YOUR_USER_ID_HERE';

// GET profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(tempUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update profile
router.put('/profile', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const user = await User.findById(tempUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = password; // Password hashing will happen automatically if you set up pre-save hooks

    await user.save();
    res.json({ message: 'Profile updated successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;
