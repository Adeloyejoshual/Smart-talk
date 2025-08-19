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

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const privateChatRoutes = require('./routes/privateChatRoutes');
const groupChatRoutes = require('./routes/groupChatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const billingRoutes = require('./routes/billingRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve React build frontend
app.use(express.static(path.join(__dirname, '../frontend/build')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages/private', privateChatRoutes);
app.use('/api/messages/group', groupChatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);

// Catch-all route for React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Socket.IO: Online users map
const onlineUsers = new Map();

// Socket.IO JWT middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: Token missing'));
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    socket.userId = decoded.id;
    next();
  });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`📡 New connection: ${socket.id} (User: ${socket.userId})`);
  onlineUsers.set(socket.userId, socket.id);
  socket.join(socket.userId);

  io.emit('user-online', { userId: socket.userId });

  // Disconnect
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    io.emit('user-offline', { userId: socket.userId, lastSeen: new Date() });
  });

  // Join group
  socket.on('join-group', (groupId) => {
    socket.join(groupId);
    console.log(`👥 User ${socket.userId} joined group ${groupId}`);
  });

  // Typing indicators
  socket.on('typing', ({ to }) => { if (to) io.to(to).emit('typing', { from: socket.userId }); });
  socket.on('stopTyping', ({ to }) => { if (to) io.to(to).emit('stopTyping', { from: socket.userId }); });

  // Private messages
  socket.on('privateMessage', async ({ receiverId, content, replyTo = null, isForwarded = false }) => {
    if (!receiverId || !content) return;
    try {
      const newMessage = new Message({
        sender: socket.userId,
        recipient: receiverId,
        content,
        replyTo,
        isForwarded,
        status: 'sent',
        type: 'text',
      });
      await newMessage.save();
      [receiverId, socket.userId].forEach(userId => {
        io.to(userId).emit('privateMessage', {
          _id: newMessage._id,
          senderId: socket.userId,
          receiverId,
          content,
          replyTo,
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          isForwarded,
        });
      });
    } catch (err) {
      console.error('❌ Error sending private message:', err);
    }
  });

  // Delivery/read receipts
  socket.on('messageDelivered', async ({ messageId, to }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.status !== 'sent') return;
      msg.status = 'delivered';
      await msg.save();
      io.to(msg.sender.toString()).emit('messageStatusUpdate', { messageId, status: 'delivered', to });
    } catch (err) { console.error(err); }
  });

  socket.on('messageRead', async ({ messageId, to }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.status === 'read') return;
      msg.status = 'read';
      await msg.save();
      io.to(msg.sender.toString()).emit('messageStatusUpdate', { messageId, status: 'read', to });
    } catch (err) { console.error(err); }
  });

  // Group messages
  socket.on('groupMessage', async ({ groupId, content, replyTo = null, isForwarded = false }) => {
    if (!groupId || !content) return;
    try {
      const newMessage = new Message({
        sender: socket.userId,
        group: groupId,
        content,
        replyTo,
        isForwarded,
        status: 'sent',
        type: 'text',
      });
      await newMessage.save();
      io.to(groupId).emit('groupMessage', {
        _id: newMessage._id,
        senderId: socket.userId,
        groupId,
        content,
        replyTo,
        timestamp: newMessage.createdAt,
        status: newMessage.status,
        isForwarded,
      });
    } catch (err) { console.error(err); }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));