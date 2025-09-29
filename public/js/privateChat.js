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

/* === 📨 SEND GROUP MESSAGE === */
router.post("/group/send", auth, async (req, res) => {
  try {
    const { groupId, content, isForwarded } = req.body;
    if (!groupId || !content) return res.status(400).json({ error: "Missing content or groupId" });

    const newMessage = new Message({
      sender: req.userId,
      group: groupId,
      content,
      isForwarded: !!isForwarded,
      status: "sent",
    });

    await newMessage.save();
    await newMessage.populate("sender", "username");

    // Emit to all group members
    req.io?.to(groupId).emit("groupMessage", {
      _id: newMessage._id,
      groupId,
      senderId: req.userId,
      senderName: newMessage.sender.username,
      content,
      image: newMessage.image || "",
      file: newMessage.file || "",
      fileType: newMessage.fileType || "",
      timestamp: newMessage.createdAt,
      isForwarded: newMessage.isForwarded,
    });

    res.status(201).json({ success: true, message: newMessage });
  } catch (err) {
    console.error("❌ Group send error:", err);
    res.status(500).json({ error: "Failed to send group message" });
  }
});

/* === 🖼️📎 UPLOAD GROUP IMAGES / FILES === */
router.post("/group/upload/:groupId", auth, upload.array("files", 5), async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!req.files?.length) return res.status(400).json({ message: "No files uploaded" });

    const messages = await Promise.all(
      req.files.map(async (file) => {
        const url = await uploadToCloudinary(file.buffer);
        const mime = file.mimetype;
        const msg = new Message({
          sender: req.userId,
          group: groupId,
          type: mime.startsWith("image/") ? "image" : "file",
          ...(mime.startsWith("image/")
            ? { image: url }
            : { file: url, fileType: mime.split("/")[1] }),
        });
        await msg.save();
        await msg.populate("sender", "username");

        // Emit to all group members
        req.io?.to(groupId).emit("groupMessage", {
          _id: msg._id,
          groupId,
          senderId: req.userId,
          senderName: msg.sender.username,
          content: msg.content || "",
          image: msg.image || "",
          file: msg.file || "",
          fileType: msg.fileType || "",
          timestamp: msg.createdAt,
        });

        return msg;
      })
    );

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error("❌ Group upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* === 📚 GET GROUP CHAT HISTORY === */
router.get("/group-history/:groupId", auth, async (req, res) => {
  try {
    const { groupId } = req.params;

    const messages = await Message.find({ group: groupId })
      .sort({ createdAt: 1 }) // oldest first
      .populate("sender", "username");

    res.status(200).json({ success: true, messages });
  } catch (err) {
    console.error("❌ Group history error:", err);
    res.status(500).json({ error: "Failed to fetch group messages" });
  }
});

module.exports = router;