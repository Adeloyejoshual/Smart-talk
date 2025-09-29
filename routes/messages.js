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
      image: newMessage.image || "",
      file: newMessage.file || "",
      fileType: newMessage.fileType || "",
      timestamp: newMessage.createdAt,
    });

    res.status(201).json({ success: true, message: newMessage });
  } catch (err) {
    console.error("❌ Send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* === UPLOAD FILES / IMAGES === */
router.post("/private/upload", auth, upload.array("files", 5), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!req.files?.length) return res.status(400).json({ error: "No files uploaded" });

    const messages = await Promise.all(req.files.map(async file => {
      const url = await uploadToCloudinary(file.buffer);
      const mime = file.mimetype;

      const msg = new Message({
        sender: req.userId,
        recipient: receiverId,
        type: mime.startsWith("image/") ? "image" : "file",
        ...(mime.startsWith("image/") ? { image: url } : { file: url, fileType: mime.split("/")[1] }),
      });

      await msg.save();
      await msg.populate("sender", "username");

      req.io?.to(receiverId.toString()).emit("privateMessage", {
        _id: msg._id,
        senderId: req.userId,
        senderName: msg.sender.username,
        content: msg.content || "",
        image: msg.image || "",
        file: msg.file || "",
        fileType: msg.fileType || "",
        timestamp: msg.createdAt,
      });

      return msg;
    }));

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* === GET CHAT HISTORY (Paginated) === */
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

    res.status(200).json({ success: true, messages });
  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;