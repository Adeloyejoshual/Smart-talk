require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');

// Models
const Message = require('./models/Message');
const User = require('./models/User');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------
// Serve static files (CSS, JS, images, HTML)
// --------------------
app.use(express.static(path.join(__dirname, 'public'))); // for CSS, JS, assets
app.use(express.static(__dirname)); // for root HTML files

// --------------------
// Database
// --------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// --------------------
// API Routes
// --------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// --------------------
// Chat history API
// --------------------
app.get('/api/messages/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: req.query.userId },
        { sender: req.query.userId, recipient: userId }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// --------------------
// Root routes
// --------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

// --------------------
// Socket.IO
// --------------------
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: Token missing'));
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    socket.userId = decoded.id;
    next();
  });
});

const CALL_RATE = { private: 0.0033, group: 0.005 };
const activeCalls = new Map();

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
  socket.on('privateMessage', async ({ receiverId, content }) => {
    if (!receiverId || !content) return;
    const newMessage = new Message({ sender: socket.userId, recipient: receiverId, content, status: 'sent', type: 'text' });
    await newMessage.save();
    [receiverId, socket.userId].forEach(uid => {
      io.to(uid).emit('privateMessage', { _id: newMessage._id, senderId: socket.userId, receiverId: uid, content, timestamp: newMessage.createdAt });
    });
  });
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));