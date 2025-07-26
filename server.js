const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const { verifyTokenSocket } = require("./middleware/auth");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Create Socket.IO instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);     // Register/Login
app.use("/api/messages", messageRoutes); // Messages API

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Socket.IO events
let onlineUsers = {};

io.use(verifyTokenSocket); // Check JWT on socket connection

io.on("connection", (socket) => {
  const userId = socket.user.id;
  onlineUsers[userId] = socket.id;

  console.log(`✅ ${userId} connected`);

  // Notify all clients about online users
  io.emit("onlineUsers", Object.keys(onlineUsers));

  // Handle chat message
  socket.on("sendMessage", (msg) => {
    io.emit("receiveMessage", {
      user: socket.user.username,
      message: msg,
    });
  });

  // Typing indicator
  socket.on("typing", () => {
    socket.broadcast.emit("typing", socket.user.username);
  });

  // Private message
  socket.on("privateMessage", ({ toUserId, message }) => {
    const targetSocket = onlineUsers[toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("receivePrivateMessage", {
        from: socket.user.id,
        message,
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`❌ ${userId} disconnected`);
    delete onlineUsers[userId];
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

// Serve static frontend files if needed
app.get("/", (req, res) => {
  res.send("✅ SmartTalk backend is running");
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});