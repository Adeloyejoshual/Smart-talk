const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

// 📩 Send new message (username or email allowed)
router.post("/send", verifyToken, async (req, res) => {
  try {
    const { receiverIdentifier, content, fileUrl = "", type = "text" } = req.body;
    if (!receiverIdentifier || (!content && !fileUrl)) return res.status(400).json({ success: false, error: "Missing data" });
    // ✅ Find receiver by username OR email
    const receiver = await User.findOne({ $or: [{ username: receiverIdentifier }, { email: receiverIdentifier }] });
    if (!receiver) return res.status(404).json({ success: false, error: "Receiver not found" });
    const sender = await User.findById(req.userId);
    if (!sender) return res.status(404).json({ success: false, error: "Sender not found" });
    const message = new Message({
      senderEmail: sender.email,
      senderUsername: sender.username,
      receiverEmail: receiver.email,
      receiverUsername: receiver.username,
      content,
      type: fileUrl ? "file" : type,
      fileUrl,
      status: "sent"
    });
    await message.save();
    const populated = await message.populate("sender", "username email avatar")
      .populate("receiver", "username email avatar");
    res.json({ success: true, message: populated });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

You'll also need to update your code for fetching chat history to include the sender's username and receiver's username.

Here's an updated version of the code for fetching chat history:
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

module.exports = router;