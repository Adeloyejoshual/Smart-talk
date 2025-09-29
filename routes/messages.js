// routes/messages.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Message = require("../models/Chat");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// ------------------ AUTH MIDDLEWARE ------------------
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id || decoded.userId;
    req.username = decoded.username || "me";
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// ------------------ FETCH PRIVATE MESSAGES ------------------
// GET /api/messages/:partnerId
router.get("/:partnerId", authMiddleware, async (req, res) => {
  const { partnerId } = req.params;
  const userId = req.userId;

  try {
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: partnerId },
        { sender: partnerId, receiver: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    const formatted = messages.map((msg) => ({
      _id: msg._id,
      sender: {
        id: msg.sender._id,
        username: msg.sender.username,
        avatar: msg.sender.avatar,
      },
      receiver: {
        id: msg.receiver?._id,
        username: msg.receiver?.username,
        avatar: msg.receiver?.avatar,
      },
      content: msg.content,
      fileUrl: msg.fileUrl || null,
      fileType: msg.fileType || "text",
      status: msg.status,
      createdAt: msg.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// ------------------ SEND MESSAGE ------------------
// POST /api/messages/send
router.post("/send", authMiddleware, async (req, res) => {
  const { recipient, content } = req.body;
  if (!recipient) return res.status(400).json({ message: "Recipient required" });

  try {
    const newMsg = new Message({
      sender: req.userId,
      receiver: recipient,
      content: content || "",
      status: "sent",
      createdAt: new Date(),
      fileType: "text",
    });

    await newMsg.save();

    const msgWithSender = await newMsg.populate("sender", "username avatar");

    res.json({
      _id: msgWithSender._id,
      sender: {
        id: msgWithSender.sender._id,
        username: msgWithSender.sender.username,
        avatar: msgWithSender.sender.avatar,
      },
      receiver: recipient,
      content: msgWithSender.content,
      fileUrl: null,
      fileType: "text",
      status: msgWithSender.status,
      createdAt: msgWithSender.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;