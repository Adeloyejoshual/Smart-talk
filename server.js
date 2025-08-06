const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const socketIO = require("socket.io");
const path = require("path");

// Load environment variables
dotenv.config();

// App setup
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve frontend files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads"))); // Serve uploaded images

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/admin", require("./routes/admin"));

// Launch HTTP server
const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

// Setup Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🧠 Attach `io` to every request (important for Socket.IO in routes)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Load message model
const Message = require("./models/Message");

// === SOCKET.IO EVENTS ===
io.on("connection", (socket) => {
  console.log("📡 New connection:", socket.id);

  // Join a room with the user's ID
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`🟢 User joined room: ${userId}`);
  });

  // Private chat
  socket.on("privateMessage", async ({ senderId, receiverId, content }) => {
    try {
      const newMessage = new Message({
        sender: senderId,
        recipient: receiverId,
        content,
      });

      await newMessage.save();

      io.to(receiverId).emit("privateMessage", {
        senderId,
        content,
        timestamp: newMessage.createdAt,
      });

      console.log(`📩 Private message from ${senderId} to ${receiverId}: ${content}`);
    } catch (err) {
      console.error("❌ Error sending private message:", err.message);
    }
  });

  // Group join
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
    console.log(`👥 Joined group: ${groupId}`);
  });

  // Group chat
  socket.on("group-message", async ({ group, sender, text }) => {
    try {
      const newMessage = new Message({
        sender: sender._id || sender,
        group,
        content: text,
      });

      await newMessage.save();

      io.to(group).emit("group-message", {
        group,
        sender,
        text,
        timestamp: newMessage.createdAt,
      });

      console.log(`📨 Group message in ${group}: ${text}`);
    } catch (err) {
      console.error("❌ Group message error:", err.message);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});