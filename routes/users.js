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

// ✅ Add friend by email
router.post('/add-friend', verifyToken, async (req, res) => {
  const { email } = req.body;
  const userId = req.userId;

  if (!email) {
    return res.status(400).json({ message: 'Please provide a valid email' });
  }

  try {
    const user = await User.findById(userId);
    const friend = await User.findOne({ email });

    if (!friend) {
      return res.status(404).json({ message: 'User with that email not found' });
    }

    if (friend._id.equals(user._id)) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: 'User is already your friend' });
    }

    user.friends.push(friend._id);
    await user.save();

    res.status(200).json({ message: 'Friend added successfully' });
  } catch (err) {
    console.error('Add friend error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;