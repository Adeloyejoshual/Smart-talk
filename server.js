// server.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./models/Message'); // Message model

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// MongoDB connection
const MONGO_URI = 'mongodb+srv://adeloyejoshua2020:<443450>@smarttalk.3gxk7it.mongodb.net/?retryWrites=true&w=majority&appName=Smarttalk';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Serve static files (like index.html)
app.use(express.static('public'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('👤 A user connected');

  // Send old messages when new user connects
  Message.find().sort({ timestamp: 1 }).limit(100).exec((err, messages) => {
    if (!err) {
      socket.emit('oldMessages', messages);
    }
  });

  // Listen for incoming chat messages
  socket.on('chatMessage', async (data) => {
    const newMessage = new Message({
      username: data.username,
      message: data.message
    });

    try {
      await newMessage.save();
      io.emit('chatMessage', newMessage); // send to all clients
    } catch (err) {
      console.error('❌ Failed to save message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('👤 A user disconnected');
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
