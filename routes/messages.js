const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

// 📩 Save new message
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      content,
      timestamp: new Date(),
    });

    await newMessage.save();
    res.status(201).json({ success: true, message: "Message saved", data: newMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error saving message", error: error.message });
  }
});

// 📜 Fetch chat history between two users
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const myId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: userId },
        { sender: userId, receiver: myId }
      ]
    }).sort({ timestamp: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching messages", error: error.message });
  }
});

module.exports = router;