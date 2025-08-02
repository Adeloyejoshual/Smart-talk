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
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/settings", settingsRoutes);

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Socket.IO real-time features
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  // Track online user
  socket.on("userOnline", async ({ userId }) => {
    onlineUsers[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
    io.emit("updateUserStatus", { userId, online: true });
  });

  // Send message
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

    // Emit to receiver if online
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("privateMessage", {
        _id: message._id,
        senderId,
        content,
        fileUrl,
        fileType,
        status: "sent",
        createdAt: message.createdAt,
      });
    }

    // Also confirm to sender
    const senderSocket = onlineUsers[senderId];
    if (senderSocket) {
      io.to(senderSocket).emit("privateMessageSent", message);
    }
  });

  // Read receipt
  socket.on("markAsRead", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { read: true, status: "read" });
    if (msg && onlineUsers[msg.sender]) {
      io.to(onlineUsers[msg.sender]).emit("messageRead", { messageId });
    }
  });

  // Soft delete message
  socket.on("deleteMessage", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { deleted: true });
    if (msg) {
      io.emit("messageDeleted", { messageId });
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const userId = Object.keys(onlineUsers).find(id => onlineUsers[id] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
      io.emit("updateUserStatus", { userId, online: false });
    }
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SmartTalk running at http://localhost:${PORT}`);
});