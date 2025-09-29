// routes/messages.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message"); // MongoDB model
const authMiddleware = require("../middleware/authMiddleware"); // optional for JWT auth

// GET messages with a specific partner
router.get("/:partnerId", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user.id; // from JWT auth
    const partnerId = req.params.partnerId;

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: partnerId },
        { sender: partnerId, receiver: currentUser },
      ],
    }).sort({ date: 1 }); // oldest to newest

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// POST a new message
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { receiver, content, date } = req.body;
    const sender = req.user.id;

    const newMessage = new Message({
      sender,
      receiver,
      content,
      date: date ? new Date(date) : new Date(),
    });

    await newMessage.save();

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;