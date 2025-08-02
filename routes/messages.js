const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// ✅ Send a new message
router.post("/", async (req, res) => {
  const { sender, receiver, content, type, attachmentUrl, fileUrl, fileType } = req.body;

  if (!sender || !receiver) {
    return res.status(400).json({ message: "Sender and receiver are required" });
  }

  try {
    const message = new Message({
      sender,
      receiver,
      content: type === "text" ? content : "",
      type: type || "text",
      attachmentUrl: attachmentUrl || "",
      fileUrl: fileUrl || null,
      fileType: fileType || null,
    });

    await message.save();
    res.status(201).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error sending message" });
  }
});

// ✅ Get messages between two users
router.get("/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
      deleted: false,
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username email")
      .populate("receiver", "username email");

    res.status(200).json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error fetching messages" });
  }
});

// ✅ Mark all messages as read from sender to receiver
router.put("/read", async (req, res) => {
  const { sender, receiver } = req.body;

  try {
    await Message.updateMany(
      { sender, receiver, read: false },
      { $set: { read: true, status: "read" } }
    );
    res.status(200).json({ message: "Messages marked as read" });
  } catch (err) {
    console.error("Read receipt error:", err);
    res.status(500).json({ message: "Server error updating read status" });
  }
});

// ✅ Delete a specific message (soft delete)
router.delete("/:messageId", async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    message.deleted = true;
    await message.save();

    res.status(200).json({ message: "Message deleted" });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ message: "Server error deleting message" });
  }
});

module.exports = router;