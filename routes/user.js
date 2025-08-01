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

// ------------------ PROFILE ------------------

// Edit profile route
router.post('/edit-profile', authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { username, email },
      { new: true }
    );
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get current user's profile
router.get('/me', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// ------------------ FRIENDS ------------------

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

// ------------------ SEARCH ------------------

// GET /api/users/search?query=...
router.get("/search", authenticateToken, async (req, res) => {
  const { query } = req.query;

  try {
    const user = await User.findById(req.user.id);

    let users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user.id } // exclude self
    });

    // Filter out blocked users
    users = users.filter(u => !user.blockedUsers.includes(u._id));

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------ SETTINGS OPTIONS ------------------

// Customer Service Message
router.post('/customer-service', authenticateToken, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message is required' });

  console.log(`Customer Service Message from ${req.user.id}:`, message);
  res.json({ message: 'Customer service message received' });
});

// Contact Message
router.post('/contact', authenticateToken, async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: 'Subject and message required' });
  }

  console.log(`Contact message from ${req.user.id} - ${subject}: ${message}`);
  res.json({ message: 'Contact form submitted' });
});

module.exports = router;