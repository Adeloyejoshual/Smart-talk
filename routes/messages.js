const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

// 📩 Send new message (username or email allowed)
router.get("/history/:identifier", verifyToken, async (req, res) => {
  try {
    const identifier = req.params.identifier;
    // Find the other user by username or email
    const otherUser = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!otherUser) return res.status(404).json({ success: false, error: "User not found" });
    const messages = await Message.find({ $or: [
      { senderEmail: req.user.email, receiverEmail: otherUser.email },
      { senderEmail: otherUser.email, receiverEmail: req.user.email },
    ]})
      .sort({ createdAt: 1 })
      .populate("sender", "username email avatar")
      .populate("receiver", "username email avatar");
    res.json({ success: true, messages });
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 📜 Get chat history (username or email allowed)
router.get("/history/:identifier", verifyToken, async (req, res) => {
  try {
    const identifier = req.params.identifier;

    // Find the other user by username or email
    const otherUser = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });
    if (!otherUser) return res.status(404).json({ success: false, error: "User not found" });

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: otherUser._id },
        { sender: otherUser._id, receiver: req.userId },
      ]
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username email avatar")
      .populate("receiver", "username email avatar");

    res.json({ success: true, messages });
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;