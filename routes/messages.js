// routes/messages.js

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

// Middleware to verify token and extract userId
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id || decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// ✅ Send a message
router.post("/send", authMiddleware, async (req, res) => {
  const { receiverId, content, fileUrl, fileType } = req.body;

  if (!receiverId || (!content && !fileUrl)) {
    return res.status(400).json({ message: "Message content or file is required." });
  }

  try {
    const message = await Message.create({
      sender: req.userId,
      receiver: receiverId,
      content: content || "",
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      status: "sent",
      createdAt: new Date(),
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
});

// ✅ Get chat history between two users
router.get("/history/:userId", authMiddleware, async (req, res) => {
  const friendId = req.params.userId;

  try {
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: friendId },
        { sender: friendId, receiver: req.userId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages", error: err.message });
  }
});

// ✅ Mark messages from a specific sender as read
router.post("/read", authMiddleware, async (req, res) => {
  const { senderId } = req.body;

  if (!senderId) return res.status(400).json({ message: "Sender ID required" });

  try {
    await Message.updateMany(
      { sender: senderId, receiver: req.userId, status: { $ne: "read" } },
      { $set: { status: "read" } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
});

// ✅ Export messages to a downloadable text file
router.get("/export/:userId/:friendId", authMiddleware, async (req, res) => {
  const { userId, friendId } = req.params;

  if (req.userId !== userId) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId },
      ],
    }).sort({ createdAt: 1 });

    let exportText = "";
    for (const msg of messages) {
      const senderLabel = msg.sender.toString() === userId ? "You" : "Them";
      const timeString = new Date(msg.createdAt).toLocaleString();
      const content = msg.content || msg.fileUrl || "[File]";
      exportText += `${senderLabel} [${timeString}]: ${content}\n`;
    }

    res.setHeader("Content-Disposition", "attachment; filename=chat.txt");
    res.setHeader("Content-Type", "text/plain");
    res.send(exportText);
  } catch (err) {
    res.status(500).json({ message: "Error exporting chat" });
  }
});

// ✅ Delete a message (only if sender)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (msg.sender.toString() !== req.userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await msg.deleteOne();
    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete message", error: err.message });
  }
});

module.exports = router;