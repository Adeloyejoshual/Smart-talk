const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const socketIO = require("socket.io");
const path = require("path");

// Load env
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// MongoDB
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/admin", require("./routes/admin"));

// Start HTTP server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Setup Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Message model
const Message = require("./models/Message");

// === SOCKET.IO EVENTS ===
io.on("connection", (socket) => {
  console.log("📡 User connected:", socket.id);

  // Join private room (user's ID)
  socket.on("join", (userId) => {
    socket.join(userId);
  });

  // Private message
  socket.on("privateMessage", async ({ senderId, receiverId, content }) => {
    const newMsg = new Message({
      sender: senderId,
      recipient: receiverId,
      content,
    });
    await newMsg.save();

    io.to(receiverId).emit("privateMessage", {
      senderId,
      content,
      timestamp: new Date().toISOString(),
    });
  });

  // Join group room
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
  });

  // Group message
  socket.on("group-message", async ({ group, sender, text }) => {
    const newMsg = new Message({
      sender: sender._id || sender,
      group,
      content: text,
    });
    await newMsg.save();

    io.to(group).emit("group-message", {
      group,
      sender,
      text,
      timestamp: newMsg.createdAt,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});