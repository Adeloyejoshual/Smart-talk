const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search users by email or username
router.get('/search', async (req, res) => {
  const query = req.query.q;
  try {
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    }).select('-password');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;