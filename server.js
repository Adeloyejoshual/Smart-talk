require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path'); // ✅ Add this line

const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// ✅ Serve static frontend from public directory
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ✅ Socket.io real-time messaging
io.on('connection', (socket) => {
  console.log('🟢 User connected');

  socket.on('chatMessage', (data) => {
    const message = {
      sender: data.sender,
      content: data.content,
      timestamp: new Date(),
    };
    io.emit('chatMessage', message); // broadcast to all
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
