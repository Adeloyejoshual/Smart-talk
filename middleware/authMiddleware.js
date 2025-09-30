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
    console.error("JWT Error:", err);
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
    console.error(err);
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
    ).select("-password");
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ------------------ FRIENDS ------------------

// Add friend by ID (mutual friendship)
router.post("/add-friend/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const friendId = req.params.id;

    if (!user || user._id.equals(friendId)) {
      return res.status(400).json({ message: "Invalid friend" });
    }

    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ message: "Friend not found" });

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friendId);
    friend.friends.push(user._id);

    await user.save();
    await friend.save();

    res.json({ message: "Friend added", friends: user.friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not add friend." });
  }
});

// Remove friend (from both sides)
router.post("/remove-friend/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const friendId = req.params.id;

    user.friends = user.friends.filter((id) => id.toString() !== friendId);
    await user.save();

    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: req.userId },
    });

    res.json({ message: "Friend removed", friends: user.friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error removing friend" });
  }
});

// Get friend list
router.get("/friends", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate(
      "friends",
      "username email avatar status online"
    );
    res.json(user.friends);
  } catch (err) {
    console.error(err);
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
    }).select("username email avatar status online");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
  }
});

// Get all users except self
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "username email avatar status online"
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// ------------------ SUPPORT ------------------

// Customer Service
router.post("/customer-service", authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "Message is required" });

  console.log(`📩 Customer Service from ${req.userId}: ${message}`);
  res.json({ message: "Message received" });
});

// Contact form
router.post("/contact", authMiddleware, async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: "Subject and message required" });
  }

  console.log(`📩 Contact from ${req.userId} - ${subject}: ${message}`);
  res.json({ message: "Contact received" });
});

module.exports = router;