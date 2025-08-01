const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// ------------------ AUTH MIDDLEWARE ------------------
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id || decoded.userId; // support both key names
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// ------------------ PROFILE ------------------

// Get current user's profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Edit profile (username, email, bio, avatar, status)
router.post("/edit-profile", authMiddleware, async (req, res) => {
  try {
    const { username, email, bio, avatar, status } = req.body;
    const update = { username, email, bio, avatar, status };
    const updatedUser = await User.findByIdAndUpdate(req.userId, update, { new: true });
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ------------------ FRIENDS ------------------

// Add friend by ID, username, or email
router.post("/add-friend", authMiddleware, async (req, res) => {
  const { identifier, friendId } = req.body;

  try {
    const user = await User.findById(req.userId);
    let friend;

    if (friendId) {
      friend = await User.findById(friendId);
    } else if (identifier) {
      friend = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }],
      });
    }

    if (!friend || friend._id.equals(user._id)) {
      return res.status(400).json({ message: "Friend not found or invalid" });
    }

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friend._id);
    await user.save();

    res.json({ message: "Friend added successfully", friends: user.friends });
  } catch (err) {
    res.status(500).json({ message: "Error adding friend" });
  }
});

// Remove friend
router.put("/remove-friend/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const friendId = req.params.id;

    user.friends = user.friends.filter((id) => id.toString() !== friendId);
    await user.save();

    res.json({ message: "Friend removed", friends: user.friends });
  } catch (err) {
    res.status(500).json({ message: "Error removing friend" });
  }
});

// Get friends list
router.get("/friends", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate(
      "friends",
      "username email online lastSeen"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Failed to load friends list" });
  }
});

// ------------------ SEARCH ------------------

// List all users except self
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "username email"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Search users by query (username or email)
router.get("/search", authMiddleware, async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
      _id: { $ne: req.userId },
    }).select("username email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

// ------------------ SETTINGS / CONTACT ------------------

// Customer Service Message
router.post("/customer-service", authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "Message is required" });

  console.log(`Customer Service Message from ${req.userId}:`, message);
  res.json({ message: "Customer service message received" });
});

// Contact Message
router.post("/contact", authMiddleware, async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: "Subject and message required" });
  }

  console.log(`Contact message from ${req.userId} - ${subject}: ${message}`);
  res.json({ message: "Contact form submitted" });
});

module.exports = router;