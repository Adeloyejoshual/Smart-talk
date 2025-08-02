const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

// Load env variables
dotenv.config();

const User = require("./models/User");
const Message = require("./models/Chat");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");
const settingsRoutes = require("./routes/settings");

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
app.use(express.static(path.join(__dirname, "public"))); // Exposes /login.html etc.

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/settings", settingsRoutes);

// Optional Middleware: protect APIs (add to route if needed)
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Serve login.html by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Optional: redirect unauthorized access to home/chat.html
app.get("/home.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});
app.get("/chat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

// SOCKET.IO REAL-TIME LOGIC
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("userOnline", async ({ userId }) => {
    onlineUsers[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
    io.emit("updateUserStatus", { userId, online: true });
  });

  socket.on("privateMessage", async ({ senderId, receiverId, content, fileUrl, fileType }) => {
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      type: fileType ? "file" : "text",
    });
    await message.save();

    const receiverSocket = onlineUsers[receiverId];
    const senderSocket = onlineUsers[senderId];

    const sender = await User.findById(senderId);
    const senderName = sender ? sender.username : "Unknown";

    const messagePayload = {
      _id: message._id,
      senderId,
      receiverId,
      senderName,
      content,
      fileUrl,
      fileType,
      type: message.type,
      status: "sent",
      createdAt: message.createdAt,
    };

    if (receiverSocket) {
      io.to(receiverSocket).emit("privateMessage", messagePayload);
    }

    if (senderSocket) {
      io.to(senderSocket).emit("privateMessageSent", messagePayload);
    }
  });

  socket.on("markAsRead", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { read: true, status: "read" });
    if (msg && onlineUsers[msg.sender]) {
      io.to(onlineUsers[msg.sender]).emit("messageRead", { messageId });
    }
  });

  socket.on("deleteMessage", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { deleted: true });
    if (msg) {
      io.emit("messageDeleted", { messageId });
    }
  });

  socket.on("typing", async ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers[receiverId];
    const sender = await User.findById(senderId);
    const senderName = sender ? sender.username : "Someone";

    if (receiverSocket) {
      io.to(receiverSocket).emit("typing", { senderName });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("stopTyping", { from: senderId });
    }
  });

  socket.on("disconnect", async () => {
    const userId = Object.keys(onlineUsers).find(id => onlineUsers[id] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
      io.emit("updateUserStatus", { userId, online: false });
    }
    console.log("❌ Disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SmartTalk running: http://localhost:${PORT}`);
});