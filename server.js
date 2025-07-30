const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

// Route imports
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const contactRoutes = require('./routes/contact');
const userExtraRoutes = require('./routes/user'); // ✅ Includes /add-friend

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);   // includes all user routes like search, profile, add-friend
app.use('/api/messages', messageRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', userExtraRoutes);   // ✅ add-friend, etc.
app.use('/api/messages', messageRoutes);

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Online users map
const onlineUsers = new Map();

// Socket.IO chat logic
io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

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
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
    console.log('❌ Disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});