const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

// Send a new message
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, type, fileUrl } = req.body;
    if (!receiverId) return res.status(400).json({ error: "Receiver ID is required" });

    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      content: content || "",
      type: type || "text",
      fileUrl: fileUrl || "",
      fileType: type === "text" ? "text" : type,
      status: "sent",
    });

    await newMessage.save();

    const populated = await newMessage
      .populate("sender", "username")
      .populate("receiver", "username");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get chat history
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id },
      ],
    })
      .populate("sender", "username")
      .populate("receiver", "username")
      .sort({ createdAt: 1 }); // oldest first

    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

module.exports = router;