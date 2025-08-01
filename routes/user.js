// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to check token
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Get current logged-in user's profile
router.get('/me', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// Get friends list
router.get('/friends', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).populate('friends', 'username email online lastSeen');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user.friends);
});

// Add friend by username, email, or friendId
router.post('/add-friend', authenticateToken, async (req, res) => {
  const { identifier, friendId } = req.body;

  try {
    const user = await User.findById(req.user.id);
    let friend;

    if (friendId) {
      friend = await User.findById(friendId);
    } else if (identifier) {
      friend = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }]
      });
    } else {
      return res.status(400).json({ message: 'Identifier or friendId required' });
    }

    if (!friend || friend._id.equals(user._id)) {
      return res.status(400).json({ message: 'Friend not found or invalid' });
    }

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    user.friends.push(friend._id);
    await user.save();

    res.json({ message: 'Friend added successfully' });
  } catch (err) {
    console.error('Error adding friend:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;