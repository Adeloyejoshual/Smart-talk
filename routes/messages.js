const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ---------------- FILE UPLOAD SETUP ----------------
const uploadPath = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// ---------------- SEND MESSAGE ----------------
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, type, fileUrl } = req.body;
    if (!receiverId) {
      return res.status(400).json({ error: "Receiver ID required" });
    }

    const newMessage = new Message({
      sender: req.userId,
      receiver: receiverId,
      content: content || "",
      type: type || "text",
      fileUrl: fileUrl || "",
      fileType: type === "text" ? "text" : type,
      status: "sent",
    });

    await newMessage.save();
    const populated = await newMessage
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------------- SEND FILE MESSAGE ----------------
router.post("/file", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { recipient } = req.body;
    if (!recipient) {
      return res.status(400).json({ error: "Recipient ID required" });
    }

    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "file";
    const newMessage = new Message({
      sender: req.userId,
      receiver: recipient,
      type: fileType,
      fileType: fileType,
      fileUrl: `/uploads/${req.file.filename}`,
      status: "sent",
    });

    await newMessage.save();
    const populated = await newMessage
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error("❌ File upload failed:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ---------------- GET CHAT HISTORY (with pagination) ----------------
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    // Pagination params (defaults: page=1, limit=20)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId },
      ],
    })
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar")
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit);

    // Reverse so UI shows oldest first
    const ordered = messages.reverse();

    const totalMessages = await Message.countDocuments({
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId },
      ],
    });

    res.json({
      success: true,
      messages: ordered,
      pagination: {
        page,
        limit,
        totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: page * limit < totalMessages,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching chat history:", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

module.exports = router;