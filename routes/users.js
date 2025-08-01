// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search users by username or email
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error searching users' });
  }
});

// Get all users
router.get('/list', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error getting users' });
  }
});

module.exports = router;