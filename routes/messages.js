const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');

// Fetch message history between two users
router.get('/:from/:to', async (req, res) => {
  const { from, to } = req.params;
  try {
    const chats = await Chat.find({
      $or: [
        { from, to },
        { from: to, to: from }
      ]
    }).sort({ timestamp: 1 }).populate('from', 'username');

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

module.exports = router;