// routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get all messages (e.g., for dashboard or chat history)
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Post a new message (optional if you're using only Socket.IO)
router.post('/', async (req, res) => {
  try {
    const { sender, content } = req.body;
    const newMessage = new Message({ sender, content });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages by sender (optional feature)
router.get('/:sender', async (req, res) => {
  try {
    const sender = req.params.sender;
    const messages = await Message.find({ sender }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages for sender' });
  }
});

module.exports = router;