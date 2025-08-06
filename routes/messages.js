const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const Message = require("../models/Message");
const auth = require("../middleware/verifyToken");
const uploadToCloudinary = require("../utils/cloudinaryUpload");

dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* === 📨 PRIVATE TEXT MESSAGE SEND === */
router.post("/private/send", auth, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    if (!recipientId || !content) {
      return res.status(400).json({ error: "Content or recipient missing" });
    }

    const newMessage = new Message({
      sender: req.userId,
      recipient: recipientId,
      content,
      status: "sent",
    });

    await newMessage.save();
    await newMessage.populate("sender", "username");

    req.io?.to(recipientId).emit("privateMessage", {
      senderId: req.userId,
      content,
      timestamp: newMessage.createdAt,
    });

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("❌ Send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* === 🖼️ PRIVATE IMAGE UPLOAD === */
router.post("/private/image", auth, upload.array("images", 5), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!req.files?.length) return res.status(400).json({ message: "No images" });

    const messages = await Promise.all(req.files.map(async (file) => {
      const imageUrl = await uploadToCloudinary(file.buffer);
      const msg = new Message({ sender: req.userId, recipient: receiverId, image: imageUrl });
      await msg.save();
      return msg;
    }));

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

/* === 📚 GET PRIVATE CHAT HISTORY === */
router.get("/history/:receiverId", auth, async (req, res) => {
  try {
    const { receiverId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: receiverId },
        { sender: receiverId, recipient: req.userId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* === 📝 EDIT MESSAGE === */
router.put("/edit/:id", auth, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: "Not found" });

    if (message.sender.toString() !== req.userId) return res.status(403).json({ error: "Unauthorized" });

    message.content = content;
    message.isEdited = true;
    await message.save();

    res.status(200).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: "Edit failed" });
  }
});

/* === ❌ DELETE MESSAGE === */
router.delete("/delete/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: "Not found" });

    if (message.sender.toString() !== req.userId) return res.status(403).json({ error: "Unauthorized" });

    message.isDeleted = true;
    await message.save();

    res.status(200).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;