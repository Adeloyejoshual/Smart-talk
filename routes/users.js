const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

// =================== MIDDLEWARE ===================
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

// =================== FILE UPLOAD CONFIG ===================
const uploadPath = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// =================== ROUTES ===================

// ✅ Get current user info
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Search users
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const q = req.query.q;
    const users = await User.find({
      $or: [
        { username: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
      ],
      _id: { $ne: req.user.id },
    }).select("username email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

// ✅ NEW: Get all users (except current)
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user.id } },
      "username email avatar"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Could not load users" });
  }
});

// ✅ Add friend
router.post("/add-friend", authMiddleware, async (req, res) => {
  try {
    const { identifier } = req.body;
    const currentUser = await User.findById(req.user.id);

    const friendUser = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!friendUser) return res.status(404).json({ error: "User not found" });
    if (friendUser._id.equals(currentUser._id)) {
      return res.status(400).json({ error: "Cannot add yourself" });
    }
    if (currentUser.friends.includes(friendUser._id)) {
      return res.status(400).json({ error: "Already friends" });
    }

    currentUser.friends.push(friendUser._id);
    await currentUser.save();

    res.json({ message: "Friend added!" });
  } catch (err) {
    res.status(500).json({ message: "Could not add friend" });
  }
});

// ✅ Get friend list
router.get("/chats", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "friends",
      "username email avatar"
    );
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "Could not retrieve friends" });
  }
});

// ✅ Remove friend
router.delete("/remove-friend/:friendId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.friends = user.friends.filter(
      (id) => id.toString() !== req.params.friendId
    );
    await user.save();
    res.json({ message: "Friend removed." });
  } catch (err) {
    res.status(500).json({ message: "Could not remove friend" });
  }
});

// ✅ Upload avatar
router.post(
  "/upload-avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      user.avatar = "/uploads/" + req.file.filename;
      await user.save();
      res.json({ avatar: user.avatar });
    } catch (err) {
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

module.exports = router;