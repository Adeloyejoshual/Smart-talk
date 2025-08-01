// server.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const socketIO = require('socket.io');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const messageRoutes = require('./routes/messages');

const User = require('./models/User');
const Chat = require('./models/Chat');

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Serve login.html by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch((err) => console.error('❌ MongoDB Error:', err));

// SOCKET.IO
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('🟢 New client connected');

  socket.on('user-online', ({ userId }) => {
    onlineUsers.set(userId, socket.id);
    io.emit('online-users', Array.from(onlineUsers.keys()));
  });

  socket.on('send-message', async ({ senderId, receiverId, message }) => {
    const newChat = new Chat({ sender: senderId, receiver: receiverId, message });
    await newChat.save();

    const targetSocket = onlineUsers.get(receiverId);
    if (targetSocket) {
      io.to(targetSocket).emit('receive-message', { senderId, message });
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit('online-users', Array.from(onlineUsers.keys()));
    console.log('🔴 Client disconnected');
  });
});

// Start Server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});