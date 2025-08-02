const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");

// Load env variables
dotenv.config();

// Models
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
    origin: "*", // or set to your frontend URL for better security
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serves /login.html, /home.html etc.

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

// Serve login page by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// --- SOCKET.IO REAL-TIME LOGIC ---
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 New connection:", socket.id);

  // When a user comes online
  socket.on("userOnline", async ({ userId }) => {
    onlineUsers[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
    io.emit("updateUserStatus", { userId, online: true });
  });

  // Handle private message
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

    // Send to receiver if online
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("privateMessage", {
        _id: message._id,
        senderId,
        receiverId,
        content,
        fileUrl,
        fileType,
        type: message.type,
        status: "sent",
        createdAt: message.createdAt,
      });
    }

    // Confirm delivery to sender
    const senderSocket = onlineUsers[senderId];
    if (senderSocket) {
      io.to(senderSocket).emit("privateMessageSent", message);
    }
  });

  // Mark message as read
  socket.on("markAsRead", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { read: true, status: "read" });
    if (msg && onlineUsers[msg.sender]) {
      io.to(onlineUsers[msg.sender]).emit("messageRead", { messageId });
    }
  });

  // Soft delete
  socket.on("deleteMessage", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { deleted: true });
    if (msg) {
      io.emit("messageDeleted", { messageId });
    }
  });

  // Typing indicator
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("typing", { from: senderId });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("stopTyping", { from: senderId });
    }
  });

  // On disconnect
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