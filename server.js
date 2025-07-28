// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Models
const Message = require('./models/Message');

// Routes
const authRoutes = require('./routes/auth'); // 🔥 Must exist

// App setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes); // ✅ Login/Register working now

// Serve static HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('chatMessage', async ({ sender, content }) => {
    const newMessage = new Message({ sender, content });
    await newMessage.save();

    io.emit('chatMessage', {
      sender,
      content,
      timestamp: newMessage.timestamp,
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});