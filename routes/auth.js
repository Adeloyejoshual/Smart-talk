const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate token (optional for future)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Set token in cookie (optional)
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // change to true if using https
      maxAge: 24 * 60 * 60 * 1000
    });

    // ✅ Send redirect instruction to client
    res.status(200).json({ message: 'Login successful', redirect: '/home.html' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;