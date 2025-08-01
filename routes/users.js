const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Search users
router.get("/search", async (req, res) => {
  const query = req.query.q;
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ]
    }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error searching users." });
  }
});

// List all users
router.get("/list", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users." });
  }
});

module.exports = router;