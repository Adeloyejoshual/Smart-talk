// server.js

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");

dotenv.config();

// Models
const User = require("./models/User");
const Message = require("./models/Message"); // Adjust name if needed

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");
const uploadRoutes = require("./routes/upload");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Change to your frontend URL for production
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads"))); // Serve uploaded files

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);

// Static HTML frontend
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

// --- SOCKET.IO CHAT LOGIC ---

const onlineUsers = new Map();

// JWT authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Token required"));

  jwt.verify(token, process.env.JWT_SECRET || "supersecretkey123", (err, decoded) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);
  console.log(`🔌 User connected: ${userId}`);

  // Update user online status
  User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }).catch(console.error);

  // Join private chat room
  socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
    const roomId = [sender, receiverId].sort().join("_");
    socket.join(roomId);
    socket.data.roomId = roomId;
  });

  // Handle sending private message
  socket.on("private message", async ({ to, message, fileUrl, fileType }) => {
    const from = userId;

    try {
      const newMsg = new Message({
        sender: from,
        receiver: to,
        content: message || "",
        attachmentUrl: fileUrl || null,
        type: fileType || "text",
        read: false,
        createdAt: new Date(),
      });

      await newMsg.save();

      const toSocketId = onlineUsers.get(to);
      if (toSocketId) {
        io.to(toSocketId).emit("private message", {
          from,
          message: newMsg.content,
          fileUrl: newMsg.attachmentUrl,
          fileType: newMsg.type,
          status: "sent",
          timestamp: newMsg.createdAt.toISOString(),
          messageId: newMsg._id.toString(),
        });
      }

      // Emit to sender as well (confirmation)
      socket.emit("private message", {
        from,
        message: newMsg.content,
        fileUrl: newMsg.attachmentUrl,
        fileType: newMsg.type,
        status: "sent",
        timestamp: newMsg.createdAt.toISOString(),
        messageId: newMsg._id.toString(),
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  // Message status update (e.g., read)
  socket.on("message status update", async ({ messageId, status }) => {
    if (!messageId || !status) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      msg.status = status;
      await msg.save();

      const senderSocketId = onlineUsers.get(msg.sender.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("message status update", { messageId, status });
      }
    } catch (err) {
      console.error("Status update error:", err.message);
    }
  });

  // Typing indicator
  socket.on("typing", ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit("typing", { from: userId });
    }
  });

  socket.on("stop typing", ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit("stop typing", { from: userId });
    }
  });

  // On disconnect
  socket.on("disconnect", async () => {
    console.log(`❌ User disconnected: ${userId}`);
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, {
      online: false,
      lastSeen: new Date(),
    }).catch(console.error);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SmartTalk server running on port ${PORT}`);
});