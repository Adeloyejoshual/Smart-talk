const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Look for user by username OR email
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Successful login → redirect to home.html with username in query
    res.redirect(`/home.html?username=${encodeURIComponent(user.username)}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;