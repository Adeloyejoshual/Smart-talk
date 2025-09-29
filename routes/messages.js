const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const Message = require("../models/Message");
const auth = require("../middleware/verifyToken");
const uploadToCloudinary = require("../utils/cloudinaryUpload");

dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* === SEND PRIVATE TEXT MESSAGE === */
router.post("/private/send", auth, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    if (!recipientId || !content) return res.status(400).json({ error: "Missing content or recipient" });

    const newMessage = new Message({
      sender: req.userId,
      recipient: recipientId,
      content,
      status: "sent",
    });

    await newMessage.save();
    await newMessage.populate("sender", "username");

    // Emit to receiver
    req.io?.to(recipientId.toString()).emit("privateMessage", {
      _id: newMessage._id,
      senderId: req.userId,
      senderName: newMessage.sender.username,
      content: newMessage.content,
      timestamp: newMessage.createdAt,
    });

    // Send back to sender (so it shows instantly)
    res.status(201).json({
      success: true,
      message: {
        _id: newMessage._id,
        senderId: req.userId,
        senderName: newMessage.sender.username,
        content: newMessage.content,
        timestamp: newMessage.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ Send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* === GET CHAT HISTORY === */
router.get("/history/:receiverId", auth, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { skip = 0, limit = 50 } = req.query;

    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: receiverId },
        { sender: receiverId, recipient: req.userId },
      ],
    })
      .sort({ createdAt: 1 }) // oldest first
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("sender", "username");

    const formatted = messages.map(msg => ({
      _id: msg._id,
      senderId: msg.sender._id,
      senderName: msg.sender.username,
      content: msg.content,
      timestamp: msg.createdAt,
    }));

    res.status(200).json({ success: true, messages: formatted });
  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;