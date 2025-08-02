const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// ------------------ AUTH MIDDLEWARE ------------------
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id || decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// ------------------ PROFILE ------------------

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Edit profile
router.post("/edit-profile", authMiddleware, async (req, res) => {
  try {
    const { username, email, bio, avatar, status } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { username, email, bio, avatar, status },
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ------------------ FRIENDS ------------------

// Add friend by email or username
router.post("/add-friend", authMiddleware, async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Friend identifier is required" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const friend = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });

    if (!friend || friend._id.equals(user._id)) {
      return res.status(400).json({ message: "Invalid friend" });
    }

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friend._id);
    await user.save();

    res.json({ message: "Friend added", friend });
  } catch (err) {
    console.error("Add friend error:", err);
    res.status(500).json({ message: "Server error while adding friend" });
  }
});

// Remove friend
router.put("/remove-friend/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.friends = user.friends.filter(id => id.toString() !== req.params.id);
    await user.save();
    res.json({ message: "Friend removed", friends: user.friends });
  } catch (err) {
    res.status(500).json({ message: "Error removing friend" });
  }
});

// Get friend list
router.get("/friends", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("friends", "username email avatar status");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Failed to load friends" });
  }
});

// ------------------ SEARCH ------------------

// Search users
router.get("/search", authMiddleware, async (req, res) => {
  const query = req.query.q || req.query.query;
  try {
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("username email avatar");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

// Get all users except self
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select("username email avatar");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// ------------------ SUPPORT ------------------

// Customer Service
router.post("/customer-service", authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "Message is required" });

  console.log(`Customer Service from ${req.userId}: ${message}`);
  res.json({ message: "Message received" });
});

// Contact form
router.post("/contact", authMiddleware, async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: "Subject and message required" });
  }

  console.log(`Contact from ${req.userId} - ${subject}: ${message}`);
  res.json({ message: "Contact received" });
});

module.exports = router;