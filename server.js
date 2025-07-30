// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

// Route Middleware
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);      // Includes search, add-friend, profile, etc.
app.use('/api/messages', messageRoutes);

// Default page (login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Socket.IO for real-time chat
const users = {};

io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id);

  socket.on('user-online', (userId) => {
    users[userId] = socket.id;
    io.emit('online-users', Object.keys(users));
  });

  socket.on('send-private-message', ({ senderId, receiverId, message }) => {
    const receiverSocket = users[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit('receive-private-message', {
        senderId,
        message,
        timestamp: new Date()
      });
    }
  });

  socket.on('disconnect', () => {
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
    io.emit('online-users', Object.keys(users));
    console.log('🔴 A user disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));