// routes/messages.js
const express = require("express");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// 📩 Send Message
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, type, fileUrl } = req.body;

    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      content,
      type: type || "text",
      fileUrl: fileUrl || "",
      status: "sent",
    });

    await newMessage.save();
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// 📜 Get chat history
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id },
      ],
    })
      .populate("sender", "username")
      .populate("receiver", "username")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

module.exports = router;