const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Get chat history with a partner
router.get("/:username", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const partner = await User.findOne({ username: req.params.username });
    if (!partner) return res.status(404).json({ message: "User not found" });

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: partner._id },
        { sender: partner._id, recipient: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username")
      .populate("recipient", "username");

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// Send new message
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { recipient, content } = req.body;
    const senderId = req.userId;

    const recipientUser = await User.findOne({ username: recipient });
    if (!recipientUser) return res.status(404).json({ message: "Recipient not found" });

    const newMessage = new Message({
      sender: senderId,
      recipient: recipientUser._id,
      content,
    });

    await newMessage.save();
    await newMessage.populate("sender", "username");
    await newMessage.populate("recipient", "username");

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;