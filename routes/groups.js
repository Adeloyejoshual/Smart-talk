const express = require("express");
const jwt = require("jsonwebtoken");
const Group = require("../models/Group");
const User = require("../models/User");

const router = express.Router();

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Create group
router.post("/", auth, async (req, res) => {
  const { name, members } = req.body;
  const group = await Group.create({ name, members: [req.user._id, ...members] });
  res.json(group);
});

// Get user's groups
router.get("/", auth, async (req, res) => {
  const groups = await Group.find({ members: req.user._id });
  res.json(groups);
});

module.exports = router;