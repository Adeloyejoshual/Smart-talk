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
    const { recipientId, content, replyTo, isForwarded } = req.body;
    if (!recipientId || (!content && !replyTo)) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const newMessage = new Message({
      sender: req.userId,
      recipient: recipientId,
      content,
      replyTo: replyTo || null,
      isForwarded: !!isForwarded,
      status: "sent",
    });

    await newMessage.save();
    await newMessage.populate("sender", "username");

    req.io?.to(recipientId).emit("privateMessage", {
      _id: newMessage._id,
      senderId: req.userId,
      content,
      replyTo: newMessage.replyTo,
      timestamp: newMessage.createdAt,
      isForwarded,
    });

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("❌ Send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* === 🖼️📎 PRIVATE IMAGE / FILE UPLOAD === */
router.post("/private/upload", auth, upload.array("files", 5), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!req.files?.length) return res.status(400).json({ message: "No files" });

    const messages = await Promise.all(
      req.files.map(async (file) => {
        const url = await uploadToCloudinary(file.buffer);
        const mime = file.mimetype;
        let msgData = {
          sender: req.userId,
          recipient: receiverId,
        };

        if (mime.startsWith("image/")) {
          msgData.image = url;
        } else {
          msgData.file = url;
          msgData.fileType = mime.split("/")[1];
        }

        const message = new Message(msgData);
        await message.save();
        return message;
      })
    );

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* === 📚 GET CHAT HISTORY === */
router.get("/history/:receiverId", auth, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { skip = 0, limit = 20 } = req.query;

    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: receiverId },
        { sender: receiverId, recipient: req.userId },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("replyTo");

    res.status(200).json({ success: true, messages });
  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json({ error: "Fetch error" });
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

/* === ⭐ STAR OR UNSTAR MESSAGE === */
router.put("/star/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: "Not found" });

    message.isStarred = !message.isStarred;
    await message.save();

    res.status(200).json({ success: true, starred: message.isStarred });
  } catch (err) {
    res.status(500).json({ error: "Star update failed" });
  }
});

/* === 🔁 FORWARD MESSAGE === */
router.post("/forward/:id", auth, async (req, res) => {
  try {
    const original = await Message.findById(req.params.id);
    const { recipientId } = req.body;
    if (!original || !recipientId) return res.status(400).json({ error: "Missing data" });

    const forwarded = new Message({
      sender: req.userId,
      recipient: recipientId,
      content: original.content,
      image: original.image,
      file: original.file,
      fileType: original.fileType,
      isForwarded: true,
    });

    await forwarded.save();

    res.status(201).json({ success: true, message: forwarded });
  } catch (err) {
    res.status(500).json({ error: "Forward failed" });
  }
});

module.exports = router;