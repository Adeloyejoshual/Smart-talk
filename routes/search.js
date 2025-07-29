const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search users by username or Gmail
router.get('/', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ msg: 'Search query is required' });

  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('-password');

    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Server error during search' });
  }
});

module.exports = router;