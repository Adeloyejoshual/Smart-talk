const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

const User = require("./models/User");
const Message = require("./models/Chat");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Socket.IO Connection
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Set user online
  socket.on("userOnline", async ({ userId }) => {
    onlineUsers[userId] = socket.id;
    const user = await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
    io.emit("updateUserStatus", { userId, online: true });
  });

  // Send private message
  socket.on("privateMessage", async ({ senderId, receiverId, content, fileUrl, fileType }) => {
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      fileUrl,
      fileType,
      type: fileType ? "file" : "text",
    });
    await message.save();

    if (onlineUsers[receiverId]) {
      io.to(onlineUsers[receiverId]).emit("privateMessage", {
        _id: message._id,
        senderId,
        content,
        fileUrl,
        fileType,
        status: "sent",
        createdAt: message.createdAt,
      });
    }

    // Also emit to sender
    if (onlineUsers[senderId]) {
      io.to(onlineUsers[senderId]).emit("privateMessageSent", message);
    }
  });

  // Mark message as read
  socket.on("markAsRead", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { status: "read", read: true });
    if (msg && onlineUsers[msg.sender]) {
      io.to(onlineUsers[msg.sender]).emit("messageRead", { messageId });
    }
  });

  // Delete message
  socket.on("deleteMessage", async ({ messageId }) => {
    const msg = await Message.findByIdAndUpdate(messageId, { deleted: true });
    if (msg) {
      io.emit("messageDeleted", { messageId });
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    const userId = Object.keys(onlineUsers).find((key) => onlineUsers[key] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
      io.emit("updateUserStatus", { userId, online: false });
    }
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SmartTalk running on port ${PORT}`));