const express = require("express");
const Message = require("../models/Message");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// JWT middleware
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Get 1-on-1 chat
router.get("/:otherUserId", auth, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user._id, recipient: req.params.otherUserId },
      { sender: req.params.otherUserId, recipient: req.user._id },
    ],
  }).sort("createdAt");
  res.json(messages);
});

module.exports = router;