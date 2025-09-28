const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// ✅ Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log("📥 Register Request:", { username, email });

    if (!username || !email || !password) {
      console.warn("⚠️ Missing fields during registration");
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      console.warn("⚠️ Duplicate user:", existingUser.username, existingUser.email);
      return res.status(400).json({ error: "Username or email already in use" });
    }

    const user = new User({ username, email, password });
    await user.save();

    console.log("✅ User registered:", user.username);

    res.status(201).json({
      message: "User created",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Registration Error:", err.message, err.stack);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ✅ Login with email or username
router.post("/login", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    console.log("📥 Login Request:", { email, username });

    if (!password || (!email && !username)) {
      console.warn("⚠️ Missing login fields");
      return res.status(400).json({ error: "Username/email and password are required" });
    }

    const user = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (!user) {
      console.warn("⚠️ User not found for:", email || username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.warn("⚠️ Wrong password for:", user.username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("✅ Login success:", user.username);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err.message, err.stack);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;