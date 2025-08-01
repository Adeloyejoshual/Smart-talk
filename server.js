// server.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const socketIo = require('socket.io');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const messageRoutes = require('./routes/messages');

const User = require('./models/User');
const Message = require('./models/Chat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Serve default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Serve pages
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/home.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chat.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/settings.html'));
});

// Store online users
const onlineUsers = new Map();

// Socket.IO Middleware for JWT Auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth token missing'));

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Auth token invalid'));
    socket.user = user;
    next();
  });
});

// Socket.IO Events
io.on('connection', (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);

  // Update online status
  User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }).catch(console.error);

  console.log(`User connected: ${userId}`);

  // Handle private messages
  socket.on('private message', async ({ to, message }) => {
    const from = userId;

    // Save to MongoDB
    const newMsg = new Message({ sender: from, receiver: to, content: message });
    await newMsg.save();

    const toSocketId = onlineUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('private message', {
        from,
        message,
        timestamp: new Date().toISOString()
      });
    }

    // Echo back to sender too
    socket.emit('private message', {
      from,
      message,
      timestamp: new Date().toISOString()
    });
  });

  // Typing indicators
  socket.on('typing', ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('typing', { from: userId });
    }
  });

  socket.on('stop typing', ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('stop typing', { from: userId });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    onlineUsers.delete(userId);
    console.log(`User disconnected: ${userId}`);
    try {
      await User.findByIdAndUpdate(userId, {
        online: false,
        lastSeen: new Date()
      });
    } catch (err) {
      console.error('Error updating last seen:', err.message);
    }
  });
});

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB error:', err));

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SmartTalk server running on port ${PORT}`);
});