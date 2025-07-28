// server.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const socketIO = require('socket.io');
const Message = require('./models/Message');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const profileRoutes = require('./routes/profile');
const messageRoutes = require('./routes/messages');

app.use('/auth', authRoutes);
app.use('/contact', contactRoutes);
app.use('/profile', profileRoutes);
app.use('/messages', messageRoutes);

// Socket.IO
io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  socket.on('sendMessage', async ({ sender, content }) => {
    const message = new Message({ sender, content });
    await message.save();

    io.emit('receiveMessage', message); // broadcast to all users
  });

  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// Fallback route
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`==> Your service is live 🎉`);
  console.log(`==> Available at your primary URL https://smart-talk-ko5m.onrender.com`);
});