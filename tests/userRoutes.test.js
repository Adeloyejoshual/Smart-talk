const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Joi = require("joi");
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

// ------------------ VALIDATION SCHEMAS ------------------

const editProfileSchema = Joi.object({
  username: Joi.string().min(3).max(30).optional(),
  email: Joi.string().email().optional(),
  bio: Joi.string().max(500).allow(null, '').optional(),
  avatar: Joi.string().uri().allow(null, '').optional(),
  status: Joi.string().valid("online", "offline", "busy").allow(null, '').optional(),
});

const friendIdSchema = Joi.string().hex().length(24).required();

const supportMessageSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
});

const contactSchema = Joi.object({
  subject: Joi.string().min(1).max(100).required(),
  message: Joi.string().min(1).max(1000).required(),
});

// ------------------ PROFILE ROUTES ------------------

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
    const { error } = editProfileSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.userId, updates, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ------------------ FRIENDS ROUTES ------------------

// Add friend by ID
router.post("/add-friend/:id", authMiddleware, async (req, res) => {
  try {
    const friendId = req.params.id;
    const { error } = friendIdSchema.validate(friendId);
    if (error) return res.status(400).json({ message: "Invalid friend ID" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user._id.equals(friendId)) {
      return res.status(400).json({ message: "Cannot add yourself as a friend" });
    }

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friendId);
    await user.save();

    res.json({ message: "Friend added", friends: user.friends });
  } catch (err) {
    res.status(500).json({ message: "Could not add friend." });
  }
});

// Remove friend
router.post("/remove-friend/:id", authMiddleware, async (req, res) => {
  try {
    const friendId = req.params.id;
    const { error } = friendIdSchema.validate(friendId);
    if (error) return res.status(400).json({ message: "Invalid friend ID" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.friends = user.friends.filter(id => id.toString() !== friendId);
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
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Failed to load friends" });
  }
});

// ------------------ SEARCH ROUTES ------------------

// Search users
router.get("/search", authMiddleware, async (req, res) => {
  const query = req.query.q || req.query.query;
  if (!query || query.trim() === "") {
    return res.status(400).json({ message: "Search query required" });
  }

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

// ------------------ SUPPORT ROUTES ------------------

// Customer Service message
router.post("/customer-service", authMiddleware, async (req, res) => {
  try {
    const { error } = supportMessageSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { message } = req.body;
    // Save or handle the support message as needed (e.g. DB or email)
    console.log(`Customer Service from user ${req.userId}: ${message}`);

    res.json({ message: "Message received" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send message" });
  }
});

// Contact form message
router.post("/contact", authMiddleware, async (req, res) => {
  try {
    const { error } = contactSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { subject, message } = req.body;
    // Save or handle contact message as needed (e.g. DB or email)
    console.log(`Contact from user ${req.userId} - Subject: ${subject}, Message: ${message}`);

    res.json({ message: "Contact received" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send contact message" });
  }
});

module.exports = router;