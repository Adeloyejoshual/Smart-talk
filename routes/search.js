const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ message: 'Query required' });

  try {
    const users = await User.find({
      $or: [
        { username: new RegExp(query, 'i') },
        { gmail: new RegExp(query, 'i') }
      ]
    }).select('-password');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;