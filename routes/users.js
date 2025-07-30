const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 🔍 GET /api/users/search?query=
router.get('/search', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('-password');

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ➕ POST /api/users/add-friend
router.post('/add-friend', async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'User IDs required' });
    }

    if (userId === friendId) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    user.friends.push(friendId);
    await user.save();

    res.json({ message: 'Friend added successfully', friendId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// 👤 GET /api/users/profile/:id
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// 📋 GET /api/users/list/:id
router.get('/list/:id', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.id } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user list' });
  }
});

module.exports = router;