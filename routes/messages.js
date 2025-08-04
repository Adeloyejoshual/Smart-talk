const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const auth = require("../middleware/auth");

// Get chat between two users
router.get("/:userId", auth, async (req, res) => {
  try {
    const currentUser = req.user.id;
    const otherUser = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUser, recipient: otherUser },
        { sender: otherUser, recipient: currentUser },
      ],
    }).sort("createdAt");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

module.exports = router;