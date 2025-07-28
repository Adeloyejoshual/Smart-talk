// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json('Please fill all fields.');

    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json('Username already exists.');

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json('User registered successfully');
  } catch (err) {
    res.status(500).json('Server error');
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json('Please fill all fields.');

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json('Invalid credentials');

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({ token });
  } catch (err) {
    res.status(500).json('Server error');
  }
});

module.exports = router;