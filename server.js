// server.js

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const socketIo = require('socket.io');
const Message = require('./models/Message');
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/auth', authRoutes);

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// ===== Routes =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 }).limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ===== Socket.IO Real-Time Chat =====
const onlineUsers = new Map(); // socket.id -> username
const userSockets = new Map(); // username -> socket.id

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('userOnline', (username) => {
    onlineUsers.set(socket.id, username);
    userSockets.set(username, socket.id);
    io.emit('onlineUsers', Array.from(userSockets.keys()));
  });

  socket.on('sendMessage', async (msg) => {
    const message = new Message({
      sender: msg.sender,
      content: msg.content,
      createdAt: new Date()
    });
    await message.save();

    io.emit('receiveMessage', msg);
  });

  socket.on('sendPrivateMessage', ({ from, to, content }) => {
    const targetSocketId = userSockets.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('receivePrivateMessage', { from, content });
    }
  });

  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    userSockets.delete(username);
    io.emit('onlineUsers', Array.from(userSockets.keys()));
    console.log('User disconnected:', socket.id);
  });
});

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`==> Your service is live 🎉`);
  console.log(`==> Available at your primary URL https://smart-talk-ko5m.onrender.com`);
});