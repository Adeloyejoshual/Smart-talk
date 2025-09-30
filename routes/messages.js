const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

// 📩 Send new message
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverEmail, content, fileUrl = "", type = "text" } = req.body;

    if (!receiverEmail || (!content && !fileUrl)) {
      return res.status(400).json({ success: false, error: "Missing data" });
    }

    console.log("🟢 Message request:", {
      sender: req.user.email,
      receiver: receiverEmail,
      content,
    });

    const message = new Message({
      senderEmail: req.user.email,
      receiverEmail,
      content,
      fileUrl,
      type: fileUrl ? "file" : type,
      status: "sent",
    });

    await message.save();

    res.json({ success: true, message });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 📜 Get chat history with a user
router.get("/history/:email", authMiddleware, async (req, res) => {
  try {
    const otherEmail = req.params.email;

    const messages = await Message.find({
      $or: [
        { senderEmail: req.user.email, receiverEmail: otherEmail },
        { senderEmail: otherEmail, receiverEmail: req.user.email },
      ],
    })
      .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;