// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user'); // ✅ Make sure routes/user.js exists
const messageRoutes = require('./routes/messages'); // ✅ Only include if you’ve created it

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const connectedUsers = {};

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes); // ✅ Only if messages.js exists

// Serve login page by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Socket.IO setup
io.on('connection', socket => {
  console.log('New client connected');

  socket.on('user-online', userId => {
    connectedUsers[userId] = socket.id;
    io.emit('update-user-status', connectedUsers);
  });

  socket.on('private-message', ({ senderId, receiverId, message }) => {
    const targetSocketId = connectedUsers[receiverId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private-message', { senderId, message });
    }
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    const targetSocketId = connectedUsers[receiverId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('typing', { senderId });
    }
  });

  socket.on('stop-typing', ({ senderId, receiverId }) => {
    const targetSocketId = connectedUsers[receiverId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('stop-typing', { senderId });
    }
  });

  socket.on('disconnect', () => {
    for (const userId in connectedUsers) {
      if (connectedUsers[userId] === socket.id) {
        delete connectedUsers[userId];
        break;
      }
    }
    io.emit('update-user-status', connectedUsers);
    console.log('Client disconnected');
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});