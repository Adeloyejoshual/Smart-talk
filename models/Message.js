const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// Send a message (POST /api/messages)
router.post("/", async (req, res) => {
  const { sender, receiver, content, type, attachmentUrl } = req.body;

  if (!sender || !receiver) {
    return res.status(400).json({ message: "Sender and receiver are required" });
  }

  if (type === "text" && !content) {
    return res.status(400).json({ message: "Content is required for text messages" });
  }

  if ((type === "image" || type === "file") && !attachmentUrl) {
    return res.status(400).json({ message: "Attachment URL is required for images/files" });
  }

  try {
    const newMessage = new Message({
      sender,
      receiver,
      content: type === "text" ? content : "",
      type: type || "text",
      attachmentUrl: attachmentUrl || "",
    });

    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error sending message" });
  }
});

// Get chat messages between two users (GET /api/messages/:user1/:user2)
router.get("/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username")
      .populate("receiver", "username");

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error fetching messages" });
  }
});

// Mark messages as read (POST /api/messages/read)
router.post("/read", async (req, res) => {
  const { sender, receiver } = req.body;

  if (!sender || !receiver) {
    return res.status(400).json({ message: "Sender and receiver are required" });
  }

  try {
    const result = await Message.updateMany(
      { sender, receiver, read: false },
      { $set: { read: true } }
    );

    res.json({ message: `${result.modifiedCount} messages marked as read` });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ message: "Server error marking messages as read" });
  }
});

module.exports = router;