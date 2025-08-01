const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Models
const User = require("./models/User");
const Message = require("./models/Chat");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/user"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/upload", require("./routes/upload"));

// Static page routes
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

// Socket.IO JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication token required"));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = decoded;
    next();
  });
});

// Socket.IO Events
io.on("connection", (socket) => {
  const userId = socket.user.id;
  console.log(`✅ Socket connected: ${userId}`);
  onlineUsers.set(userId, socket.id);

  // Mark user online
  User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }).catch(console.error);

  // Join private chat room
  socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
    const roomId = [sender, receiverId].sort().join("_");
    socket.join(roomId);
    socket.data.roomId = roomId;
  });

  // Handle private messages
  socket.on("private message", async ({ to, message, fileUrl, fileType }) => {
    const from = userId;

    const newMsg = await Message.create({
      sender: from,
      receiver: to,
      content: message || "",
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      status: "sent",
      createdAt: new Date(),
    });

    const toSocketId = onlineUsers.get(to);
    const payload = {
      from,
      message: newMsg.content,
      fileUrl: newMsg.fileUrl,
      fileType: newMsg.fileType,
      status: newMsg.status,
      timestamp: newMsg.createdAt.toISOString(),
      messageId: newMsg._id.toString(),
    };

    if (toSocketId) io.to(toSocketId).emit("private message", payload);
    socket.emit("private message", payload);
  });

  // Message status update
  socket.on("message status update", async ({ messageId, status }) => {
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
    if (toSocketId) io.to(toSocketId).emit("typing", { from: userId });
  });

  socket.on("stop typing", ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) io.to(toSocketId).emit("stop typing", { from: userId });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    console.log(`❌ Disconnected: ${userId}`);
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
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});