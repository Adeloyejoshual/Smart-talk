// routes/profile.js

const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// GET: Public user profile by user ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// PUT: Update current user's profile
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;

    const updateFields = {};
    if (username) updateFields.username = username;
    if (bio) updateFields.bio = bio;
    if (avatar) updateFields.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update profile' });
  }
});

module.exports = router;