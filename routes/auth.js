const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, gmail, password } = req.body;

    const userExists = await User.findOne({ $or: [{ username }, { gmail }] });
    if (userExists) {
      return res.status(400).json({ message: 'Username or Gmail already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, gmail, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { gmail, password } = req.body;

    const user = await User.findOne({ gmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, gmail: user.gmail }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.cookie('token', token, { httpOnly: true });
    res.status(200).json({ message: 'Login successful', token, user });
  } catch (err) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;