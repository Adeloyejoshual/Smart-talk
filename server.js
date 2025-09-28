// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');

// Models
const User = require('./models/User');
const Message = require('./models/Message');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// --------------------
// Chat History API
// --------------------
app.get('/api/messages/history/:receiverId', async (req, res) => {
  const { receiverId } = req.params;
  const senderId = req.query.senderId;

  if (!senderId) return res.status(400).json({ error: 'senderId query required' });

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, recipient: receiverId },
        { sender: receiverId, recipient: senderId }
      ]
    }).sort({ createdAt: 1 }); // oldest first
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Root route (serves login by default)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// --------------------
// Socket.IO
// --------------------
const onlineUsers = new Map();
const CALL_RATE = { private: 0.0033, group: 0.005 };
const activeCalls = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: Token missing'));
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    socket.userId = decoded.id;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`📡 Connected: ${socket.id} (User: ${socket.userId})`);
  onlineUsers.set(socket.userId, socket.id);
  socket.join(socket.userId);
  io.emit('user-online', { userId: socket.userId });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    io.emit('user-offline', { userId: socket.userId, lastSeen: new Date() });
  });

  // Private messages
  socket.on('privateMessage', async ({ receiverId, content, replyTo = null, isForwarded = false }) => {
    if (!receiverId || !content) return;
    try {
      const newMessage = new Message({
        sender: socket.userId,
        recipient: receiverId,
        content,
        replyTo,
        isForwarded,
        status: 'sent',
        type: 'text',
      });
      await newMessage.save();

      [receiverId, socket.userId].forEach(uid => {
        io.to(uid).emit('privateMessage', {
          _id: newMessage._id,
          senderId: socket.userId,
          receiverId: uid,
          content,
          replyTo,
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          isForwarded,
        });
      });
    } catch (err) {
      console.error('❌ Private message error:', err);
    }
  });

  // Group messages
  socket.on('groupMessage', async ({ groupId, content, replyTo = null, isForwarded = false }) => {
    if (!groupId || !content) return;
    try {
      const newMessage = new Message({
        sender: socket.userId,
        group: groupId,
        content,
        replyTo,
        isForwarded,
        status: 'sent',
        type: 'text',
      });
      await newMessage.save();
      io.to(groupId).emit('groupMessage', {
        _id: newMessage._id,
        senderId: socket.userId,
        groupId,
        content,
        replyTo,
        timestamp: newMessage.createdAt,
        status: newMessage.status,
        isForwarded,
      });
    } catch (err) {
      console.error('❌ Group message error:', err);
    }
  });

  // Calls with billing
  socket.on('startCall', async ({ callId, type, participants }) => {
    if (!callId || !type || !participants || !Array.isArray(participants)) return;

    for (let userId of participants) {
      const user = await User.findById(userId);
      const rate = CALL_RATE[type] || CALL_RATE.private;
      if (!user || user.wallet < rate) {
        socket.emit('callError', { message: `User ${userId} has insufficient balance` });
        return;
      }
    }

    const interval = setInterval(async () => {
      for (let userId of participants) {
        const user = await User.findById(userId);
        const rate = CALL_RATE[type] || CALL_RATE.private;
        if (user.wallet >= rate) {
          user.wallet -= rate;
          await user.save();
        } else {
          clearInterval(activeCalls.get(callId).interval);
          io.to(participants).emit('endCall', { callId, reason: 'Insufficient balance' });
          activeCalls.delete(callId);
          return;
        }
      }
    }, 1000);

    activeCalls.set(callId, { users: participants, interval });
    io.to(participants).emit('callStarted', { callId, type });
  });

  socket.on('endCall', ({ callId }) => {
    const call = activeCalls.get(callId);
    if (call) {
      clearInterval(call.interval);
      io.to(call.users).emit('endCall', { callId, reason: 'Ended by user' });
      activeCalls.delete(callId);
    }
  });
});

// Start Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));