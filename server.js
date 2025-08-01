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

// Get consistent room ID for 2 users
function getRoomId(user1, user2) {
  return [user1, user2].sort().join('-');
}

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Track online users
  socket.on("userOnline", (userId) => {
    onlineUsers[userId] = socket.id;
    console.log("📡 Online Users:", onlineUsers);
    io.emit('online-users', Object.keys(onlineUsers));
  });

  // Join private chat room
  socket.on("joinRoom", ({ from, to }) => {
    const roomId = getRoomId(from, to);
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${from} joined room ${roomId}`);
  });

  // Handle private message
  socket.on("privateMessage", async ({ from, to, message }) => {
    const roomId = getRoomId(from, to);
    io.to(roomId).emit("privateMessage", { from, message, timestamp: new Date() });

    // Save message to DB
    try {
      const Chat = require('./models/Chat');
      const newMessage = new Chat({ from, to, message });
      await newMessage.save();
    } catch (error) {
      console.error("💾 Error saving chat message:", error.message);
    }
  });

  // Disconnect
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