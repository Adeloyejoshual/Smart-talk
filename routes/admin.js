// routes/admin.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

// GET /api/admin/users - Admin view all users
router.get("/users", verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;