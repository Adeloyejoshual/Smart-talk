// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// API routes
app.use('/api/auth', require('./routes/auth'));

// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// SOCKET.IO chat logic
io.on('connection', socket => {
  console.log('📡 User connected:', socket.id);

  socket.on('sendMessage', async (data) => {
    const { token, content } = data;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      const newMsg = new Message({ sender: userId, content });
      await newMsg.save();

      const populatedMsg = await Message.findById(newMsg._id).populate('sender', 'username');

      io.emit('newMessage', {
        sender: populatedMsg.sender.username,
        content: populatedMsg.content,
        timestamp: populatedMsg.timestamp
      });
    } catch (err) {
      console.error('❌ Invalid token:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// Run server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});