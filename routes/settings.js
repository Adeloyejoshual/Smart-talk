const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Edit Profile (e.g., username)
router.put("/edit", async (req, res) => {
  try {
    const { userId, newUsername } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username: newUsername },
      { new: true }
    );
    res.json({ success: true, updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update profile." });
  }
});

// Contact Customer Support
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    // For now just log it
    console.log("Contact message:", { name, email, message });
    res.json({ success: true, message: "Message received. We'll get back to you soon." });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to send message." });
  }
});

module.exports = router;