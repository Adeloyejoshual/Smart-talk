const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// JWT middleware
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

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
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Search users (exclude self and already added friends)
router.get("/search", authMiddleware, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

// ✅ Add friend
router.post("/add-friend", authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.friends.includes(friendId)) {
      user.friends.push(friendId);
      await user.save();
      return res.json({ message: "Friend added!" });
    }

    res.status(400).json({ message: "Already friends" });
  } catch (err) {
    res.status(500).json({ message: "Could not add friend" });
  }
});

// ✅ List friends
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("friends", "username email");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Could not retrieve friends" });
  }
});

// ✅ Remove friend
router.delete("/remove-friend/:friendId", authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;
    const user = await User.findById(req.user.id);

    user.friends = user.friends.filter(f => f.toString() !== friendId);
    await user.save();

    res.json({ message: "Friend removed." });
  } catch (err) {
    res.status(500).json({ message: "Could not remove friend" });
  }
});

module.exports = router;