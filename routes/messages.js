const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');

// Send a message
router.post('/send', async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    const message = new Chat({
      sender: senderId,
      receiver: receiverId,
      content
    });

    await message.save();

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
});

// Get chat history between two users
router.get('/history', async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'Missing senderId or receiverId' });
    }

    const messages = await Chat.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    }).sort({ timestamp: 1 }).populate('sender', 'username').populate('receiver', 'username');

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching history', error: err.message });
  }
});

module.exports = router;