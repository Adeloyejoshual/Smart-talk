const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chat = require('../models/Chat');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT auth middleware
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  const cleanToken = token.replace(/^Bearer\s+/i, '');
  jwt.verify(cleanToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Failed to authenticate token' });
    req.userId = decoded.id;
    next();
  });
}

// ========== REGISTER ==========
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, profileImage } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      profileImage,
      friends: [],
      blocked: []
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// ========== SEARCH USERS ==========
router.get('/search', verifyToken, async (req, res) => {
  try {
    const query = req.query.q;
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.userId }
    }).select('username email profileImage');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// ========== GET AVAILABLE USERS ==========
router.get('/list', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).populate('friends blocked');
    const friendsIds = currentUser.friends.map(f => f._id.toString());
    const blockedIds = currentUser.blocked.map(b => b._id.toString());

    const chats = await Chat.find({
      $or: [{ sender: req.userId }, { receiver: req.userId }]
    });

    const inChatWith = chats.map(chat =>
      chat.sender.toString() === req.userId
        ? chat.receiver.toString()
        : chat.sender.toString()
    );

    const excludedIds = [req.userId, ...blockedIds, ...inChatWith];
    const users = await User.find({ _id: { $nin: excludedIds } })
      .select('username email profileImage');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'User list fetch failed', error: err.message });
  }
});

// ========== ADD FRIEND (Mutual) ==========
router.post('/add-friend/:id', verifyToken, async (req, res) => {
  try {
    const friendId = req.params.id;
    const currentUser = await User.findById(req.userId);
    const friendUser = await User.findById(friendId);

    if (!friendUser) return res.status(404).json({ message: 'User not found' });

    if (currentUser.friends.includes(friendId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    currentUser.friends.push(friendId);
    friendUser.friends.push(req.userId);

    await currentUser.save();
    await friendUser.save();

    res.json({ message: 'Friend added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Add friend failed', error: err.message });
  }
});

// ========== BLOCK USER ==========
router.post('/block/:id', verifyToken, async (req, res) => {
  try {
    const blockId = req.params.id;
    const user = await User.findById(req.userId);

    if (user.blocked.includes(blockId)) {
      return res.status(400).json({ message: 'User already blocked' });
    }

    user.blocked.push(blockId);
    await user.save();

    res.json({ message: 'User blocked successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Block failed', error: err.message });
  }
});

module.exports = router;