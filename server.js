const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const socketIO = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");
const User = require("./models/User"); 
const Message = require("./models/Message");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/admin", require("./routes/admin"));

const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

const io = socketIO(server, {
  cors: {
    origin: "*", // Change this to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

// Map to track userId -> socket.id for online status
const onlineUsers = new Map();

// Socket.IO middleware for JWT authentication
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication error: Token missing"));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error: Invalid token"));
    socket.userId = decoded.id;
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`📡 New connection: ${socket.id} (User: ${socket.userId})`);

  // Add user to online list and join their private room
  onlineUsers.set(socket.userId, socket.id);
  socket.join(socket.userId);

  // Broadcast online status to all connected clients
  io.emit("user-online", { userId: socket.userId });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id} (User: ${socket.userId})`);
    onlineUsers.delete(socket.userId);

    io.emit("user-offline", { userId: socket.userId, lastSeen: new Date() });
  });

  // Join a group room
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
    console.log(`👥 User ${socket.userId} joined group ${groupId}`);
  });

  // Typing indicator events
  socket.on("typing", ({ to }) => {
    if (to) {
      io.to(to).emit("typing", { from: socket.userId });
    }
  });

  socket.on("stopTyping", ({ to }) => {
    if (to) {
      io.to(to).emit("stopTyping", { from: socket.userId });
    }
  });

  // Handle private messages
  socket.on("privateMessage", async ({ receiverId, content, replyTo = null, isForwarded = false }) => {
    if (!receiverId || !content) return;

    try {
      const newMessage = new Message({
        sender: socket.userId,
        recipient: receiverId,
        content,
        replyTo,
        isForwarded,
        status: "sent",
        type: "text",
      });

      await newMessage.save();

      // Emit to receiver and sender to update their UI
      [receiverId, socket.userId].forEach((userId) => {
        io.to(userId).emit("privateMessage", {
          _id: newMessage._id,
          senderId: socket.userId,
          receiverId,
          content,
          replyTo,
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          isForwarded,
        });
      });

      console.log(`📩 Private message from ${socket.userId} to ${receiverId}: ${content}`);
    } catch (err) {
      console.error("❌ Error sending private message:", err);
    }
  });

  // Handle delivery receipts
  socket.on("messageDelivered", async ({ messageId, to }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (msg.status === "sent") {
        msg.status = "delivered";
        await msg.save();

        io.to(msg.sender.toString()).emit("messageStatusUpdate", {
          messageId,
          status: "delivered",
          to,
        });
      }
    } catch (err) {
      console.error("❌ Error updating message delivered status:", err);
    }
  });

  // Handle read receipts
  socket.on("messageRead", async ({ messageId, to }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (msg.status !== "read") {
        msg.status = "read";
        await msg.save();

        io.to(msg.sender.toString()).emit("messageStatusUpdate", {
          messageId,
          status: "read",
          to,
        });
      }
    } catch (err) {
      console.error("❌ Error updating message read status:", err);
    }
  });

  // Handle group chat messages
  socket.on("groupMessage", async ({ groupId, content, replyTo = null, isForwarded = false }) => {
    if (!groupId || !content) return;

    try {
      const newMessage = new Message({
        sender: socket.userId,
        group: groupId,
        content,
        replyTo,
        isForwarded,
        status: "sent",
        type: "text",
      });

      await newMessage.save();

      io.to(groupId).emit("groupMessage", {
        _id: newMessage._id,
        senderId: socket.userId,
        groupId,
        content,
        replyTo,
        timestamp: newMessage.createdAt,
        status: newMessage.status,
        isForwarded,
      });

      console.log(`📨 Group message in ${groupId}: ${content}`);
    } catch (err) {
      console.error("❌ Error sending group message:", err);
    }
  });
});