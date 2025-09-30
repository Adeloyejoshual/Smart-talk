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
    const ext = path.extname(file.originalname);
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

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
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar")
      .sort({ createdAt: 1 }); // oldest first

    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// ---------------- SEND TEXT MESSAGE ----------------
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, type } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: "Invalid message" });

    const newMessage = new Message({
      sender: req.userId,
      receiver: receiverId,
      content,
      type: type || "text",
      fileUrl: "",
      status: "sent",
    });

    await newMessage.save();

    const populated = await newMessage.populate("sender", "username avatar")
                                        .populate("receiver", "username avatar");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------------- SEND FILE/IMAGE ----------------
router.post("/file", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId || !req.file) return res.status(400).json({ error: "Recipient or file missing" });

    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "file";

    const newMessage = new Message({
      sender: req.userId,
      receiver: receiverId,
      content: "",
      type: fileType,
      fileType,
      fileUrl: `/uploads/${req.file.filename}`,
      status: "sent",
    });

    await newMessage.save();

    const populated = await newMessage.populate("sender", "username avatar")
                                        .populate("receiver", "username avatar");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File upload failed" });
  }
});

module.exports = router;