// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Failed to authenticate token' });
    req.userId = decoded.id;
    next();
  });
}

// ✅ Add friend by email or username
router.post('/add-friend', verifyToken, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Please provide email or username' });

    const currentUser = await User.findById(req.userId);
    if (!currentUser) return res.status(404).json({ message: 'Current user not found' });

    const friend = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!friend) return res.status(404).json({ message: 'User not found' });

    if (friend._id.equals(currentUser._id)) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    if (currentUser.friends.includes(friend._id)) {
      return res.status(400).json({ message: 'User already added as a friend' });
    }

    currentUser.friends.push(friend._id);
    await currentUser.save();

    res.status(200).json({ message: 'Friend added successfully' });
  } catch (err) {
    console.error('Error adding friend:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;