// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Default route (homepage or login page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Socket.IO logic
const onlineUsers = new Map();

io.on('connection', socket => {
  console.log('🔌 User connected:', socket.id);

  socket.on('userOnline', ({ userId, username }) => {
    onlineUsers.set(userId, { socketId: socket.id, username });
    io.emit('updateOnlineUsers', Array.from(onlineUsers.values()));
  });

  socket.on('privateMessage', ({ senderId, receiverId, message }) => {
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('privateMessage', {
        senderId,
        message
      });
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, user] of onlineUsers) {
      if (user.socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit('updateOnlineUsers', Array.from(onlineUsers.values()));
    console.log('❌ User disconnected:', socket.id);
  });
});

// Server port
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));