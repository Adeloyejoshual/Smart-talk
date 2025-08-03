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


// Get current user info
router.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user);
});

// Search users
router.get("/search", authMiddleware, async (req, res) => {
  const q = req.query.q;
  const users = await User.find({
    $or: [
      { username: new RegExp(q, "i") },
      { email: new RegExp(q, "i") }
    ],
    _id: { $ne: req.user.id },
    friends: { $ne: req.user.id }
  }).select("username email");
  res.json(users);
});

// Add friend
router.post("/add-friend", authMiddleware, async (req, res) => {
  const { friendId } = req.body;
  const user = await User.findById(req.user.id);
  if (!user.friends.includes(friendId)) {
    user.friends.push(friendId);
    await user.save();
  }
  res.json({ message: "Friend added!" });
});

// List friends
router.get("/list", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).populate("friends", "username email");
  res.json(user.friends);
});

// ✅ Remove friend
router.delete("/remove-friend/:friendId", authMiddleware, async (req, res) => {
  const { friendId } = req.params;
  const user = await User.findById(req.user.id);
  user.friends = user.friends.filter(f => f.toString() !== friendId);
  await user.save();
  res.json({ message: "Friend removed." });
});

module.exports = router;