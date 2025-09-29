// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");
const multer = require("multer");

dotenv.config();

// Models
const User = require("./models/User");
const Message = require("./models/Chat");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

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
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// HTML Routes
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "public/home.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "public/chat.html")));
app.get("/private-chat", (req, res) => res.sendFile(path.join(__dirname, "public/private-chat.html")));
app.get("/private-chat-settings", (req, res) => res.sendFile(path.join(__dirname, "public/private-chat-settings.html")));

// Online users map
const onlineUsers = new Map();

// Socket.IO JWT middleware
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
  onlineUsers.set(userId, socket.id);
  console.log(`🔌 User connected: ${userId}`);

  // Mark user online
  User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }).catch(console.error);

  // Join private room
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
        fileUrl: fileUrl || null,
        fileType: fileType || "text",
        status: "sent",
        createdAt: new Date(),
      });
      await newMsg.save();

      const payload = {
        _id: newMsg._id,
        sender: { id: from, username: socket.user.username },
        receiver: to,
        content: newMsg.content,
        fileUrl: newMsg.fileUrl,
        fileType: newMsg.fileType,
        status: newMsg.status,
        createdAt: newMsg.createdAt,
      };

      // Send to receiver if online
      const toSocketId = onlineUsers.get(to);
      if (toSocketId) io.to(toSocketId).emit("private message", payload);

      // Echo to sender
      socket.emit("private message", payload);
    } catch (err) {
      console.error("Error sending message:", err.message);
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
    console.log(`❌ User disconnected: ${userId}`);
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() }).catch(console.error);
  });
});

// ---------------------- File Upload ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public/uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/api/messages/file", upload.single("file"), async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.id;
    const { recipient } = req.body;
    const file = req.file;

    if (!recipient || !file) return res.status(400).json({ message: "Recipient or file missing" });

    const newMsg = new Message({
      sender: senderId,
      receiver: recipient,
      fileUrl: `/uploads/${file.filename}`,
      fileType: file.mimetype.startsWith("image/") ? "image" : "file",
      content: "",
      status: "sent",
      createdAt: new Date(),
    });
    await newMsg.save();

    const payload = {
      _id: newMsg._id,
      sender: { id: senderId, username: decoded.username },
      receiver: recipient,
      content: newMsg.content,
      fileUrl: newMsg.fileUrl,
      fileType: newMsg.fileType,
      status: newMsg.status,
      createdAt: newMsg.createdAt,
    };

    // Emit to receiver if online
    const toSocketId = onlineUsers.get(recipient);
    if (toSocketId) io.to(toSocketId).emit("private message", payload);

    // Echo to sender
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "File upload failed" });
  }
});

// ---------------------- MongoDB ----------------------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 SmartTalk server running on port ${PORT}`));