// routes/messages.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ---------------- FILE UPLOAD CONFIG ----------------
const uploadPath = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ---------------- SEND TEXT MESSAGE ----------------
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content)
      return res.status(400).json({ success: false, error: "Missing data" });

    const message = new Message({
      sender: req.user.id,
      receiver: receiverId,
      content,
      type: "text",
      status: "sent",
    });
    await message.save();

    const populated = await message
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ---------------- GET CHAT HISTORY ----------------
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: userId },
        { sender: userId, receiver: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json({ success: true, messages });
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ---------------- FILE UPLOAD MESSAGE ----------------
router.post("/file", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No file uploaded" });

    const { recipient } = req.body;
    if (!recipient)
      return res.status(400).json({ success: false, error: "Missing recipient" });

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "file";

    const message = new Message({
      sender: req.user.id,
      receiver: recipient,
      fileUrl,
      type: fileType,
      fileType,
      status: "sent",
    });
    await message.save();

    const populated = await message
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json(populated);
  } catch (err) {
    console.error("❌ File upload error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;