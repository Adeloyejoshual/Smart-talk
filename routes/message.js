// routes/messages.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Get or create chat between two users
router.post('/chat', async (req, res) => {
  const { user1, user2 } = req.body;

  try {
    let chat = await Chat.findOne({
      participants: { $all: [user1, user2], $size: 2 }
    });

    if (!chat) {
      chat = new Chat({ participants: [user1, user2] });
      await chat.save();
    }

    res.json(chat);
  } catch (err) {
    console.error("Failed to get/create chat:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send a message
router.post('/send', async (req, res) => {
  const { chatId, sender, receiver, message } = req.body;

  try {
    const msg = new Message({ chatId, sender, receiver, message });
    await msg.save();
    res.json(msg);
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get all messages for a chat
router.get('/:chatId', async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

module.exports = router;