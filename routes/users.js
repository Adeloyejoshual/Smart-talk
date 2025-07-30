const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');

// Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Failed to authenticate token' });
    req.userId = decoded.id;
    next();
  });
}

// POST /api/users/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      friends: [],
      blocked: []
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: newUser._id, username, email } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// GET /api/users/search?q=username
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

// GET /api/users/list - all users excluding self, blocked, and in chat
router.get('/list', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).populate('friends blocked');
    const friendsIds = currentUser.friends.map(f => f._id.toString());
    const blockedIds = currentUser.blocked.map(b => b._id.toString());

    const chats = await Chat.find({ 
      $or: [{ sender: req.userId }, { receiver: req.userId }]
    });

    const inChatWith = chats.map(chat => (
      chat.sender.toString() === req.userId ? chat.receiver.toString() : chat.sender.toString()
    ));

    const excludedIds = [req.userId, ...blockedIds, ...inChatWith];

    const users = await User.find({ _id: { $nin: excludedIds } })
      .select('username email profileImage');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'User list fetch failed', error: err.message });
  }
});

// POST /api/users/add-friend/:id
router.post('/add-friend/:id', verifyToken, async (req, res) => {
  try {
    const friendId = req.params.id;
    const user = await User.findById(req.userId);
    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    user.friends.push(friendId);
    await user.save();

    res.json({ message: 'Friend added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Add friend failed', error: err.message });
  }
});

// POST /api/users/block/:id
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
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

// Add friend (POST /api/users/add-friend)
router.post('/add-friend', verifyToken, async (req, res) => {
  const userId = req.user.id; // logged-in user
  const { userId: friendId } = req.body; // user to add

  if (!friendId || friendId === userId) {
    return res.status(400).json({ message: "Invalid friend ID" });
  }

  try {
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!friend) return res.status(404).json({ message: "User not found" });

    // Prevent duplicate
    if (user.friends?.includes(friendId)) {
      return res.status(400).json({ message: "Already added as friend" });
    }

    // Add each other as friends
    user.friends = [...(user.friends || []), friendId];
    friend.friends = [...(friend.friends || []), userId];

    await user.save();
    await friend.save();

    res.json({ message: `You added ${friend.username} as a friend.` });
  } catch (err) {
    console.error("Add Friend Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;