// routes/messages.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

// Get chat history between two users
router.get('/:sender/:receiver', async (req, res) => {
  const { sender, receiver } = req.params;
  try {
    const messages = await Chat.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    }).sort('timestamp');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
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