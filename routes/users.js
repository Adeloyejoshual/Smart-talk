const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 🔍 Search for users by username or email
router.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('username email _id');

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ➕ Add a friend by ID
router.post('/add-friend', async (req, res) => {
  const { userId, friendId } = req.body;

  if (!userId || !friendId) {
    return res.status(400).json({ error: 'User ID and Friend ID are required' });
  }

  if (userId === friendId) {
    return res.status(400).json({ error: 'Cannot add yourself as a friend' });
  }

  try {
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.friends.includes(friendId)) {
      return res.status(409).json({ error: 'Already friends' });
    }

    user.friends.push(friendId);
    friend.friends.push(userId); // optional: mutual friendship
    await user.save();
    await friend.save();

    res.json({ success: true, message: 'Friend added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;