// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Models
const User = require("./models/User");
const Message = require("./models/Chat");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Serve login.html as default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ======= SOCKET.IO =======
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ New user connected:", socket.id);

  socket.on("userConnected", ({ userId }) => {
    onlineUsers.set(userId, socket.id);
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  // Send and save messages
  socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      message,
    });

    await newMessage.save();

    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", {
        senderId,
        receiverId,
        message,
        timestamp: newMessage.createdAt,
      });
    }

    // Send back to sender too (for instant display)
    socket.emit("receiveMessage", {
      senderId,
      receiverId,
      message,
      timestamp: newMessage.createdAt,
    });
  });

  // Typing event
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId });
    }
  });

  // On disconnect
  socket.on("disconnect", () => {
    for (let [userId, sockId] of onlineUsers) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });
});

// Start server
http.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});