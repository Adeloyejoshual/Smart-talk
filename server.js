// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const Message = require('./models/Message');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);

// Serve home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Socket.IO setup
const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log('🟢 New user connected');

  socket.on('userOnline', (username) => {
    socket.username = username;
    onlineUsers.add(username);
    io.emit('updateOnlineUsers', Array.from(onlineUsers));
  });

  socket.on('chatMessage', async ({ sender, content }) => {
    const newMessage = new Message({ sender, content });
    await newMessage.save();

    io.emit('chatMessage', {
      sender,
      content,
      timestamp: newMessage.timestamp
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected');
    if (socket.username) {
      onlineUsers.delete(socket.username);
      io.emit('updateOnlineUsers', Array.from(onlineUsers));
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});