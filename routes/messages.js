const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ---------------- FILE UPLOAD ----------------
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
    if (!receiverId) return res.status(400).json({ error: "Receiver ID required" });

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
    const populated = await newMessage.populate("sender", "username").populate("receiver", "username");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------------- SEND FILE ----------------
router.post("/file", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { recipient } = req.body;
    if (!recipient) return res.status(400).json({ error: "Recipient ID required" });

    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "file";
    const newMessage = new Message({
      sender: req.userId,
      receiver: recipient,
      type: fileType,
      fileType: fileType,
      fileUrl: `/uploads/${req.file.filename}`,
    });

    await newMessage.save();
    const populated = await newMessage.populate("sender", "username").populate("receiver", "username");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ---------------- GET CHAT HISTORY ----------------
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId },
      ],
    })
      .populate("sender", "username")
      .populate("receiver", "username")
      .sort({ createdAt: 1 }); // oldest first

    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

module.exports = router;