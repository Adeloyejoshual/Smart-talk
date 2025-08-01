const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIO = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// =======================
// 🔌 Socket.IO Logic
// =======================
const onlineUsers = {};
const Chat = require('./models/Chat');

// Generate consistent room ID
function getRoomId(user1, user2) {
  return [user1, user2].sort().join('_'); // shared ID for both users
}

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Save user as online
  socket.on("userOnline", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('online-users', Object.keys(onlineUsers));
    console.log("📡 Online users:", onlineUsers);
  });

  // Join private chat room
  socket.on("joinRoom", ({ from, to }) => {
    const roomName = getRoomId(from, to);
    socket.join(roomName);
    console.log(`✅ ${from} joined room ${roomName}`);
  });

  // Handle private messages
  socket.on("privateMessage", async ({ from, to, message }) => {
    const roomName = getRoomId(from, to);

    try {
      const newMessage = new Chat({
        from,
        to,
        message,
        timestamp: new Date(),
      });

      await newMessage.save();

      // Send message to both users in the same room
      io.to(roomName).emit("privateMessage", {
        from,
        to,
        message,
        timestamp: newMessage.timestamp,
      });

      console.log(`📨 Message from ${from} to ${to} in room ${roomName}`);
    } catch (error) {
      console.error("💾 Error saving chat message:", error.message);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('online-users', Object.keys(onlineUsers));
    console.log("🔴 User disconnected:", socket.id);
  });
});

// =======================
// 🚀 Start the Server
// =======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));