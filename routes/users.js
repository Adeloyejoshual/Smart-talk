// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET all users or search by Gmail or username (excluding current user)
router.get('/', async (req, res) => {
  try {
    const current = req.query.current || "";
    const search = req.query.search || "";

    const currentUser = await User.findOne({ username: current });
    if (!currentUser) {
      return res.status(404).json({ error: "Current user not found" });
    }

    const currentFriends = currentUser.friends.map(id => id.toString());

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
    
    const result = users.map(user => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      isFriend: currentFriends.includes(user._id.toString())
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /add-friend → Add a friend by user ID
router.post('/add-friend', async (req, res) => {
  const { currentUserId, friendId } = req.body;

  try {
    if (!currentUserId || !friendId) {
      return res.status(400).json({ error: "Missing user IDs" });
    }

    const currentUser = await User.findById(currentUserId);
    const friendUser = await User.findById(friendId);

    if (!currentUser || !friendUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (currentUser.friends.includes(friendId)) {
      return res.status(409).json({ message: "User already added as friend" });
    }

    currentUser.friends.push(friendId);
    await currentUser.save();

    res.json({ message: "Friend added successfully" });
  } catch (err) {
    console.error("Error adding friend:", err);
    res.status(500).json({ error: "Failed to add friend" });
  }
});

module.exports = router;