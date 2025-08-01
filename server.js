const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const path = require("path");
const socketIO = require("socket.io");

dotenv.config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

const User = require("./models/User");
const Message = require("./models/Chat");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Serve login.html by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Serve home.html after login success
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Serve chat.html
app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

// Serve settings.html
app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

// DATABASE
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// SOCKET.IO CONNECTION
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 New socket connected:", socket.id);

  socket.on("user-connected", async ({ userId }) => {
    onlineUsers.set(userId, socket.id);
    io.emit("update-online-users", Array.from(onlineUsers.keys()));
  });

  socket.on("private-message", async ({ senderId, receiverId, message }) => {
    const receiverSocket = onlineUsers.get(receiverId);

    const newMessage = new Message({ sender: senderId, receiver: receiverId, content: message });
    await newMessage.save();

    if (receiverSocket) {
      io.to(receiverSocket).emit("receive-message", { senderId, message });
    }
  });

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

  socket.on("disconnect", () => {
    for (let [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit("update-online-users", Array.from(onlineUsers.keys()));
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});