// routes/messages.js
const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const jwt = require("jsonwebtoken");

// Middleware to verify token and set req.userId
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// ✅ Send a message
router.post("/send", authMiddleware, async (req, res) => {
  const { receiverId, content } = req.body;

  if (!receiverId || !content) {
    return res.status(400).json({ message: "Receiver and content are required" });
  }

  try {
    const chat = new Chat({
      sender: req.userId,
      receiver: receiverId,
      content,
    });

    await chat.save();
    res.status(201).json({ message: "Message sent", data: chat });
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
});

// ✅ Get message history with another user
router.get("/history/:userId", authMiddleware, async (req, res) => {
  const otherUserId = req.params.userId;

  try {
    const messages = await Chat.find({
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username")
      .populate("receiver", "username");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages", error: err.message });
  }
});

// ✅ Mark messages as read
router.post("/read", authMiddleware, async (req, res) => {
  const { senderId } = req.body;

  try {
    await Chat.updateMany(
      { sender: senderId, receiver: req.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
});

// ✅ Export messages
router.post("/export", authMiddleware, async (req, res) => {
  const { userId2 } = req.body;

  try {
    const messages = await Chat.find({
      $or: [
        { sender: req.userId, receiver: userId2 },
        { sender: userId2, receiver: req.userId },
      ],
    }).sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ message: "Failed to export messages", error: err.message });
  }
});

// ✅ Delete a specific message (only if user is sender)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const message = await Chat.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.userId)
      return res.status(403).json({ message: "Unauthorized to delete this message" });

    await message.deleteOne();
    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete message", error: err.message });
  }
});

module.exports = router;