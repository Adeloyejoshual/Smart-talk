const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Serve home page as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- Socket.IO logic ---
const users = {}; // socket.id => userId
const onlineUsers = {}; // userId => socket.id

io.on('connection', (socket) => {
  console.log(`🟢 New connection: ${socket.id}`);

  socket.on('user-connected', (userId) => {
    users[socket.id] = userId;
    onlineUsers[userId] = socket.id;
    io.emit('online-users', Object.values(onlineUsers));
  });

  socket.on('private-message', async ({ senderId, receiverId, message }) => {
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit('private-message', { senderId, message });
    }

    // Save message to DB
    const Chat = require('./models/Chat');
    try {
      await Chat.create({
        sender: senderId,
        receiver: receiverId,
        message,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('❌ Failed to save chat message:', err);
    }
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit('typing', { senderId });
    }
  });

  socket.on('disconnect', () => {
    const userId = users[socket.id];
    delete users[socket.id];
    delete onlineUsers[userId];
    io.emit('online-users', Object.values(onlineUsers));
    console.log(`🔴 Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});