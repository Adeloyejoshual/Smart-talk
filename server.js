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
const Message = require("./models/Chat");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");
const uploadRoutes = require("./routes/upload"); // For file uploads

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// Serve uploads folder to serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes); // Upload endpoint

// Static HTML routes
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

// Online users map
const onlineUsers = new Map();

// Socket.IO JWT auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Token required"));

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = user;
    next();
  });
});

// Socket.IO events
io.on("connection", (socket) => {
  const userId = socket.user.id;
  console.log(`🔌 User connected: ${userId}`);
  onlineUsers.set(userId, socket.id);

  // Mark user online and update lastSeen
  User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }).catch(console.error);

  // Join private room (optional for group/private chat segregation)
  socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
    const roomId = [sender, receiverId].sort().join("_");
    socket.join(roomId);
    socket.data.roomId = roomId;
  });

  // Handle private message (text or file)
  socket.on("private message", async ({ to, message, fileUrl, fileType }) => {
    const from = userId;

    const newMsg = new Message({
      sender: from,
      receiver: to,
      content: message || "",
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      status: "sent", // Initial status
      createdAt: new Date(),
    });

    await newMsg.save();

    const toSocketId = onlineUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit("private message", {
        from,
        message: newMsg.content,
        fileUrl: newMsg.fileUrl,
        fileType: newMsg.fileType,
        status: newMsg.status,
        timestamp: newMsg.createdAt.toISOString(),
        messageId: newMsg._id.toString(),
      });
    }

    // Echo to sender as well
    socket.emit("private message", {
      from,
      message: newMsg.content,
      fileUrl: newMsg.fileUrl,
      fileType: newMsg.fileType,
      status: newMsg.status,
      timestamp: newMsg.createdAt.toISOString(),
      messageId: newMsg._id.toString(),
    });
  });

  // Handle message status update (e.g., read)
  socket.on("message status update", async ({ messageId, status }) => {
    if (!messageId || !status) return;

    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      msg.status = status; // e.g., "read"
      await msg.save();

      // Notify sender if online
      const senderSocketId = onlineUsers.get(msg.sender.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("message status update", {
          messageId,
          status,
        });
      }
    } catch (err) {
      console.error("Error updating message status:", err.message);
    }
  });

  // Typing indicators
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

  // Disconnect
  socket.on("disconnect", async () => {
    console.log(`❌ User disconnected: ${userId}`);
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, {
      online: false,
      lastSeen: new Date(),
    }).catch(console.error);
  });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 SmartTalk server running on port ${PORT}`);
});