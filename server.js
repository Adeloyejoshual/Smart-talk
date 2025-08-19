// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');

// Models
const Message = require('./models/Message');
const User = require('./models/User');

// Use the actual route files you have
const authRoutes = require('./routes/auth');        // ✅ matches auth.js
const userRoutes = require('./routes/users');       // ✅ matches users.js
const messageRoutes = require('./routes/messages'); // ✅ matches messages.js
const groupRoutes = require('./routes/groups');     // ✅ matches groups.js
const adminRoutes = require('./routes/admin');      // ✅ matches admin.js
const paymentRoutes = require('./routes/payments'); // ✅ matches payments.js

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// (Optional) If you have a frontend build
// app.use(express.static(path.join(__dirname, '../frontend/build')));

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB connection error:', err); process.exit(1); });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// (Optional) Serve React frontend
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
// });

// --------------------
// Socket.IO
// --------------------
const onlineUsers = new Map();

// JWT middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: Token missing'));
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    socket.userId = decoded.id;
    next();
  });
});

// Billing rates
const CALL_RATE = {
  private: 0.0033, // $0.20/min
  group: 0.005     // $0.30/min
};
const activeCalls = new Map();

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`📡 Connected: ${socket.id} (User: ${socket.userId})`);
  onlineUsers.set(socket.userId, socket.id);
  socket.join(socket.userId);
  io.emit('user-online', { userId: socket.userId });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    io.emit('user-offline', { userId: socket.userId, lastSeen: new Date() });
  });

  socket.on('join-group', (groupId) => socket.join(groupId));

  // ... keep the rest of your message & call logic unchanged ...
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));