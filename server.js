require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const Message = require('./models/Message'); // ✅ Import message model

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

// ✅ Connect MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ✅ Real-time messaging
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  // When user sends a message
  socket.on('chatMessage', async ({ sender, content }) => {
    const message = new Message({ sender, content });
    await message.save();

    // Broadcast the message to all clients
    io.emit('chatMessage', {
      sender,
      content,
      timestamp: message.timestamp
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
