const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const User = require("./models/User");
const Message = require("./models/Message");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("joinRoom", ({ senderId, receiverId }) => {
    const roomName = [senderId, receiverId].sort().join("-");
    socket.join(roomName);
    socket.room = roomName;
  });

  socket.on("message", async (data) => {
    const { sender, receiver, content, senderName } = data;
    const newMessage = await Message.create({ sender, receiver, content });

    const fullMessage = {
      sender,
      receiver,
      content,
      senderName,
    };

    const roomName = [sender, receiver].sort().join("-");
    io.to(roomName).emit("message", fullMessage);
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    const roomName = [senderId, receiverId].sort().join("-");
    socket.to(roomName).emit("typing", { senderId });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// MongoDB connect and server start
const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));