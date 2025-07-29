// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all users or search by Gmail or username (excluding current user)
router.get('/', async (req, res) => {
  try {
    const current = req.query.current || "";
    const search = req.query.search || "";

    const query = {
      username: { $ne: current }
    };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;