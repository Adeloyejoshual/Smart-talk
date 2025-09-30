const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

// 📩 Send new message
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, fileUrl = "", type = "text" } = req.body;

    if (!receiverId || (!content && !fileUrl)) {
      return res.status(400).json({ success: false, error: "Missing data" });
    }

    console.log("🟢 Message request:", {
      sender: req.userId,
      receiver: receiverId,
      content,
    });

    const message = new Message({
      sender: req.userId, // ✅ FIXED: use req.userId from middleware
      receiver: receiverId,
      content,
      fileUrl,
      type: fileUrl ? "file" : type,
      status: "sent",
    });

    await message.save();

    const populated = await message
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 📜 Get chat history with a user
router.get("/history/:userId", authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    res.json({ success: true, messages });
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;