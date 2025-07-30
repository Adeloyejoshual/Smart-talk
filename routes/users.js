// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/users/add-friend
router.post('/add-friend', async (req, res) => {
  const { currentUserId, targetUsername } = req.body;

  if (!currentUserId || !targetUsername) {
    return res.status(400).json({ error: 'Missing user ID or target username.' });
  }

  try {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findOne({ username: targetUsername });

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (currentUser.friends.includes(targetUser._id)) {
      return res.status(400).json({ error: 'Already friends.' });
    }

    // Check if already friends
    const alreadyFriend = userA.friends.includes(userB._id);

    if (alreadyFriend) {
      return res.status(200).json({ message: 'Already friends.' });
    }

    // Add each other as friends
    userA.friends.push(userB._id);
    userB.friends.push(userA._id);

    await userA.save();
    await userB.save();

    res.status(200).json({ message: 'Friend added successfully.' });
  } catch (err) {
    console.error('Error adding friend:', err);
    res.status(500).json({ message: 'An error occurred.' });
  }
});

module.exports = router;