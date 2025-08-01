// routes/messages.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Chat");

// Get chat messages between two users
router.get("/:senderId/:receiverId", async (req, res) => {
  const { senderId, receiverId } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to load messages." });
  }
});

module.exports = router;