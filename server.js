const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/messages");

const User = require("./models/User");
const Chat = require("./models/Chat");
const Message = require("./models/Message");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Serve login as homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Socket.IO
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 New client connected");

  // Store userID and socket ID
  socket.on("userOnline", async ({ userId }) => {
    onlineUsers[userId] = socket.id;
    const user = await User.findByIdAndUpdate(userId, { lastSeen: "online" });
    io.emit("updateUserList", onlineUsers);
  });

  // Join private chat room
  socket.on("joinRoom", ({ chatId }) => {
    socket.join(chatId);
  });

  // Typing Indicator
  socket.on("typing", ({ chatId, sender }) => {
    socket.to(chatId).emit("typing", { sender });
  });

  socket.on("stopTyping", ({ chatId }) => {
    socket.to(chatId).emit("stopTyping");
  });

  // Message Sent
  socket.on("privateMessage", async ({ chatId, sender, receiver, content, file }) => {
    const message = new Message({
      chatId,
      sender,
      receiver,
      content,
      file,
      read: false,
    });

    await message.save();

    // Update Chat last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: content,
      updatedAt: Date.now(),
    });

    // Emit to room
    io.to(chatId).emit("newMessage", message);

    // Emit read receipt if receiver is online
    if (onlineUsers[receiver]) {
      io.to(onlineUsers[receiver]).emit("notifyMessage", message);
    }
  });

  // Mark as read
  socket.on("markAsRead", async ({ chatId, readerId }) => {
    await Message.updateMany({ chatId, receiver: readerId, read: false }, { read: true });
    io.to(chatId).emit("messagesRead", { chatId, readerId });
  });

  // Delete message
  socket.on("deleteMessage", async ({ messageId, chatId }) => {
    await Message.findByIdAndDelete(messageId);
    io.to(chatId).emit("messageDeleted", messageId);
  });

  // Disconnect
  socket.on("disconnect", async () => {
    const disconnectedUserId = Object.keys(onlineUsers).find(
      (key) => onlineUsers[key] === socket.id
    );

    if (disconnectedUserId) {
      delete onlineUsers[disconnectedUserId];
      await User.findByIdAndUpdate(disconnectedUserId, {
        lastSeen: new Date(),
      });
    }

    io.emit("updateUserList", onlineUsers);
    console.log("❌ Client disconnected");
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});