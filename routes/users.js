const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

// Get current user info
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Search for users by username or email
router.get("/search", verifyToken, async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);

  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ]
    }).select("username email");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error searching users" });
  }
});

// Add a friend by username or email
router.post("/add-friend", verifyToken, async (req, res) => {
  const { identifier } = req.body;

  try {
    const user = await User.findById(req.userId);
    const friend = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });

    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    if (friend._id.equals(user._id)) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: "Already added as friend" });
    }

    user.friends.push(friend._id);
    await user.save();

    res.json({ message: "Friend added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error adding friend" });
  }
});

// Get user's friend list
router.get("/friends", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("friends", "username email");
    res.json({ friends: user.friends });
  } catch (err) {
    res.status(500).json({ message: "Error loading friends" });
  }
});
// Update Username
router.put('/settings/username', async (req, res) => {
  const { userId, newUsername } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.username = newUsername;
    await user.save();

    res.status(200).json({ message: 'Username updated successfully', username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update Username
router.put("/update-username", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "Username required" });

    const user = await User.findByIdAndUpdate(
      userId,
      { username },
      { new: true }
    );

    res.status(200).json({ message: "Username updated", user });
  } catch (err) {
    console.error("Update username error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;

module.exports = router;