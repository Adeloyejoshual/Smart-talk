const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chat = require('../models/Chat');
const jwt = require('jsonwebtoken');

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

// GET /api/users/search?q=username - Search users
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

// GET /api/users/list - All users excluding self, blocked, and in chat
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

// POST /api/users/add-friend/:id - Add friend by userId
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

// POST /api/users/block/:id - Block user
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