const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// JWT middleware
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// ------------------ ROUTES ------------------

// ✅ Get current user info
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user info" });
  }
});

// ✅ Search users (exclude self & existing friends)
router.get("/search", authMiddleware, async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ message: "Search query is required" });

  try {
    const user = await User.findById(req.user.id);
    const users = await User.find({
      $or: [
        { username: new RegExp(q, "i") },
        { email: new RegExp(q, "i") }
      ],
      _id: { $ne: user._id },             // Exclude self
      _id: { $nin: user.friends }         // Exclude existing friends
    }).select("username email avatar");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

// ✅ Add friend
router.post("/add-friend", authMiddleware, async (req, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ message: "Friend ID is required" });

  try {
    const user = await User.findById(req.user.id);
    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ message: "Friend not found" });
    if (friend._id.equals(user._id)) return res.status(400).json({ message: "Cannot add yourself" });

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friendId);
    await user.save();
    res.json({ message: "Friend added!", friend: { id: friend._id, username: friend.username, email: friend.email } });
  } catch (err) {
    res.status(500).json({ message: "Failed to add friend" });
  }
});

// ✅ List friends
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("friends", "username email avatar status");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Failed to load friends" });
  }
});

module.exports = router;