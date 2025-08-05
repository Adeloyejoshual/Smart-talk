// routes/admin.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET /api/admin/users - View all users
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;