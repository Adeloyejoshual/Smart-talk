const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");

// Create a new message (text or file)
router.post("/", authenticate, async (req, res) => {
  try {
    const { receiver, content, fileUrl, fileType, type } = req.body;

    if (!receiver) return res.status(400).json({ message: "Receiver is required" });

    const message = new Message({
      sender: req.user.id,
      receiver,
      content: content || "",
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      type: type || "text",
    });

    await message.save();

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: "Message send failed" });
  }
});

// Get chat history between two users
router.get("/:receiverId", authenticate, async (req, res) => {
  try {
    const receiverId = req.params.receiverId;

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: receiverId },
        { sender: receiverId, receiver: req.user.id },
      ],
      deleted: false,
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

// Mark a message as read
router.put("/read/:messageId", authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    if (String(message.receiver) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized to mark as read" });
    }

    message.read = true;
    message.status = "read";
    await message.save();

    res.status(200).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to mark as read" });
  }
});

// Soft delete a message (only sender can delete)
router.delete("/:messageId", authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    if (String(message.sender) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
    }

    message.deleted = true;
    await message.save();

    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete message" });
  }
});

module.exports = router;