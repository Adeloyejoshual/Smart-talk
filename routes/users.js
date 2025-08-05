const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
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

// =================== FILE UPLOAD ===================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
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
      "username name email avatar"
    );
    const friends = user.friends.map((friend) => ({
      _id: friend._id,
      username: friend.username,
      name: friend.name,
      email: friend.email,
      avatar: friend.avatar,
      lastMessage: null,
    }));
    res.json(friends);
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

// ✅ Block
router.post("/block", async (req, res) => {
  const { userId, blockId } = req.body;
  await User.findByIdAndUpdate(userId, {
    $addToSet: { blockedUsers: blockId },
  });
  res.send("Blocked");
});

// ✅ Unblock
router.post("/unblock", async (req, res) => {
  const { userId, blockId } = req.body;
  await User.findByIdAndUpdate(userId, {
    $pull: { blockedUsers: blockId },
  });
  res.send("Unblocked");
});

// ✅ Report
router.post("/report", async (req, res) => {
  const { userId, reportId } = req.body;
  await User.findByIdAndUpdate(userId, {
    $addToSet: { reports: reportId },
  });
  res.send("Reported");
});

// ✅ Upload avatar
router.post(
  "/upload-avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      user.avatar = req.file.path;
      await user.save();
      res.json({ avatar: req.file.path });
    } catch (err) {
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

module.exports = router;