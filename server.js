// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const userRoute = require('./routes/user');
const messageRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // Includes search, list, add-friend, etc.
app.use('/api/users', userRoute);
app.use('/api/messages', messageRoutes);

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Track online users
const onlineUsers = new Map();

// Socket.IO chat logic
io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  socket.on('userOnline', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
  });

  socket.on('privateMessage', async ({ from, to, message }) => {
    const Chat = require('./models/Chat');
    const newMessage = new Chat({ from, to, message });
    await newMessage.save();

    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('privateMessage', { from, message });
    }
  });

  socket.on('typing', ({ from, to }) => {
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('typing', { from });
    }
  });

  socket.on('messageRead', async ({ from, to }) => {
    const Chat = require('./models/Chat');
    await Chat.updateMany({ from, to, read: false }, { $set: { read: true } });
  });

  socket.on('disconnect', () => {
    for (const [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
    console.log('❌ User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});