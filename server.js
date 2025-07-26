require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

// REST endpoint to fetch all messages
app.get('/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 });
  res.json(messages);
});

// Socket.io real-time logic
io.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('sendMessage', async ({ sender, content }) => {
    const message = new Message({ sender, content });
    await message.save();

    // Send message to all clients
    io.emit('receiveMessage', message);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});