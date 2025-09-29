// routes/messages.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// GET chat history with a partner
router.get("/:partnerId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const partnerId = req.params.partnerId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: partnerId },
        { sender: partnerId, recipient: currentUserId },
      ],
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username avatar")
      .populate("recipient", "username avatar");

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// POST new message
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { recipient, content, type, image, file, fileType } = req.body;
    const sender = req.user.id;

    const recipientUser = await User.findOne({ username: recipient });
    if (!recipientUser) return res.status(404).json({ message: "Recipient not found" });

    const newMessage = new Message({
      sender,
      recipient: recipientUser._id,
      content,
      type: type || "text",
      image: image || null,
      file: file || null,
      fileType: fileType || null,
    });

    await newMessage.save();
    await newMessage.populate("sender", "username avatar");
    await newMessage.populate("recipient", "username avatar");

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;