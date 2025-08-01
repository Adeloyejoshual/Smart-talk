const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const jwt = require("jsonwebtoken");
const socketIO = require("socket.io");

// Load env
dotenv.config();

// Models
const User = require("./models/User");
const Message = require("./models/Chat");

// App setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const messageRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve static pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

// Socket.IO setup
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log("❌ No token provided");
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    console.log("❌ Invalid token");
    return next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`🟢 User connected: ${userId}`);

  // Track online user
  onlineUsers.set(userId, socket.id);

  // Update DB
  User.findByIdAndUpdate(userId, { online: true }, { new: true }).exec();
  io.emit("update-online-users", Array.from(onlineUsers.keys()));

  // Handle messages
  socket.on("private-message", async ({ senderId, receiverId, message }) => {
    const receiverSocket = onlineUsers.get(receiverId);

    const newMsg = new Message({
      sender: senderId,
      receiver: receiverId,
      content: message
    });

    await newMsg.save();

    if (receiverSocket) {
      io.to(receiverSocket).emit("receive-message", {
        senderId,
        message,
        timestamp: new Date()
      });
    }
  });

  // Typing indicator
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit("typing", senderId);
    }
  });

  socket.on("stop-typing", ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit("stop-typing", senderId);
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    console.log(`🔴 User disconnected: ${userId}`);
    onlineUsers.delete(userId);
    io.emit("update-online-users", Array.from(onlineUsers.keys()));

    await User.findByIdAndUpdate(userId, {
      online: false,
      lastSeen: new Date()
    }).exec();
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});