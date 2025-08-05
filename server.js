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

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static HTML/CSS/JS
app.use("/uploads", express.static(path.join(__dirname, "public/uploads"))); // Serve uploaded images

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

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

// Socket.IO setup
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// === MODELS ===
const Message = require("./models/Message");

// === SOCKET.IO EVENTS ===
io.on("connection", (socket) => {
  console.log("📡 New connection:", socket.id);

  // Join a user-specific room
  socket.on("join", (userId) => {
    socket.join(userId);
  });

  // Private messaging
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
    } catch (err) {
      console.error("Private message error:", err.message);
    }
  });

  // Join group
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
  });

  // Group messaging
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
    } catch (err) {
      console.error("Group message error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});