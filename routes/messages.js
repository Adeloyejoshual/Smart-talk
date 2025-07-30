const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// ✅ Create or retrieve a private chat between two users
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

    res.status(200).json(chat);
  } catch (err) {
    console.error("❌ Failed to get/create chat:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Send a new message
router.post('/send', async (req, res) => {
  const { chatId, sender, receiver, message } = req.body;

  if (!chatId || !sender || !receiver || !message) {
    return res.status(400).json({ error: "All fields (chatId, sender, receiver, message) are required" });
  }

  try {
    const newMsg = new Message({
      chatId,
      sender,
      receiver,
      message
    });

    await newMsg.save();

    res.status(201).json(newMsg);
  } catch (err) {
    console.error("❌ Error sending message:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get all messages in a chat
router.get('/:chatId', async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ error: "chatId is required" });
  }

  try {
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (err) {
    console.error("❌ Error fetching messages:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Optional: Get all chats that a user is part of
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const chats = await Chat.find({ participants: userId });
    res.status(200).json(chats);
  } catch (err) {
    console.error("❌ Error fetching user chats:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;