// routes/messages.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// ✅ Create or retrieve a chat between two users
router.post('/chat', async (req, res) => {
  const { user1, user2 } = req.body;

  if (!user1 || !user2) {
    return res.status(400).json({ error: 'Both user1 and user2 are required' });
  }

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

// ✅ Send a new message in a chat
router.post('/send', async (req, res) => {
  const { chatId, sender, receiver, message } = req.body;

  if (!chatId || !sender || !receiver || !message) {
    return res.status(400).json({ error: "chatId, sender, receiver, and message are required" });
  }

  try {
    const newMsg = new Message({
      chatId,
      sender,
      receiver,
      message,
    });

    await newMsg.save();

    res.status(201).json(newMsg);
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ✅ Get all messages for a chat ID
router.get('/:chatId', async (req, res) => {
  const { chatId } = req.params;

  try {
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ✅ Get all chats for a user (optional but useful)
router.get('/user/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.params.userId });
    res.json(chats);
  } catch (err) {
    console.error("Error getting user chats:", err);
    res.status(500).json({ error: "Failed to load user chats" });
  }
});

module.exports = router;