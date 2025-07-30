const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Add friend (mutual)
router.post('/add-friend', async (req, res) => {
  const { currentUser, targetUser } = req.body;

  if (!currentUser || !targetUser) {
    return res.status(400).json({ message: 'Both users are required.' });
  }

  try {
    const userA = await User.findOne({ username: currentUser });
    const userB = await User.findOne({ username: targetUser });

    if (!userA || !userB) {
      return res.status(404).json({ message: 'One or both users not found.' });
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