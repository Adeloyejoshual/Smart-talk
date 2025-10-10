const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const admin = require("firebase-admin");
const authMiddleware = require("../middleware/authMiddleware");

// 🔹 Get all messages
router.get("/", authMiddleware, async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 });
  res.json(messages);
});

// 🔹 Post a message (fallback for non-socket clients)
router.post("/", authMiddleware, async (req, res) => {
  const { text } = req.body;
  const msg = await Message.create({
    senderUid: req.user.uid,
    senderEmail: req.user.email,
    text,
  });
  res.json(msg);
});

module.exports = router;