const express = require('express');
const app = express();
const http = require('http').createServer(app);
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const io = require('socket.io')(http);
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');
const Chat = require('./models/Chat');

dotenv.config();

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// MONGO DB CONNECT
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('MongoDB Error:', err));

// ROUTE: Default to login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// SOCKET.IO
let onlineUsers = {};

io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id);

  socket.on('userOnline', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('updateOnlineUsers', Object.keys(onlineUsers));
  });

  socket.on('privateMessage', async ({ senderId, receiverId, content }) => {
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    const newMessage = new Chat({
      sender: senderId,
      receiver: receiverId,
      content,
      timestamp: new Date(),
    });

    await newMessage.save();

    const messageData = {
      senderId,
      receiverId,
      content,
      senderName: sender.username,
      timestamp: newMessage.timestamp,
    };

    // Send to sender
    socket.emit('privateMessage', messageData);

    // Send to receiver if online
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit('privateMessage', messageData);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected:', socket.id);
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('updateOnlineUsers', Object.keys(onlineUsers));
  });
});

// START SERVER
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});