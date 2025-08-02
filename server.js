// server.js

const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Secure ENV check
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error("❌ Missing JWT_SECRET or MONGO_URI in .env file");
  process.exit(1);
}

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
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
.catch(err => {
  console.error("❌ MongoDB connection failed:", err.message);
  process.exit(1);
});

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");
const settingsRoutes = require("./routes/settings");
const verifyToken = require("./middleware/verifyToken");

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", verifyToken, userRoutes);
app.use("/api/messages", verifyToken, messageRoutes);
app.use("/api/settings", verifyToken, settingsRoutes);

// Protect HTML pages from unauthorized access
function verifyHTMLToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.redirect("/");
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.redirect("/");
  }
}

// Serve protected pages
app.get("/home.html", verifyHTMLToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/chat.html", verifyHTMLToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.get("/profile.html", verifyHTMLToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

app.get("/settings.html", verifyHTMLToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

app.get("/notification.html", verifyHTMLToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "notification.html"));
});

// Default route (login page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Online users tracking
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 A user connected:", socket.id);

  socket.on("userOnline", (userId) => {
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    console.log(`✅ User online: ${userId}`);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`❌ User offline: ${userId}`);
        break;
      }
    }
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("privateMessage", async (data) => {
    const { senderId, receiverId, content, fileUrl } = data;
    if (!senderId || !receiverId || (!content && !fileUrl)) return;

    const message = {
      senderId,
      receiverId,
      content,
      fileUrl,
      timestamp: new Date()
    };

    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("privateMessage", message);
    }

    socket.emit("privateMessage", message);

    try {
      const MessageModel = require("./models/Chat");
      const newMessage = new MessageModel(message);
      await newMessage.save();
    } catch (err) {
      console.error("💾 Failed to save message:", err.message);
    }
  });

  socket.on("typing", ({ senderId, receiverId, isTyping }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", {
        senderId,
        isTyping
      });
    }
  });
});

// Server start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});