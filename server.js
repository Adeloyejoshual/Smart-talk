const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const socketIO = require("socket.io");
const path = require("path");

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Mongo error:", err));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/admin", require("./routes/admin"));

// === HTTPS Setup ===
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, "ssl", "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "ssl", "cert.pem")),
};

const httpsServer = https.createServer(sslOptions, app);
const io = socketIO(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// === SOCKET.IO Setup ===
const Message = require("./models/Message");
const GroupMessage = require("./models/GroupMessage");

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("privateMessage", async ({ senderId, receiverId, content }) => {
    const newMsg = new Message({ sender: senderId, receiver: receiverId, content });
    await newMsg.save();

    io.to(receiverId).emit("privateMessage", {
      senderId,
      content,
      timestamp: new Date().toISOString()
    });
  });

  socket.on("join-group", (groupId) => {
    socket.join(groupId);
  });

  socket.on("group-message", async (msg) => {
    const saved = await new GroupMessage({
      group: msg.group,
      sender: msg.sender._id || msg.sender,
      text: msg.text,
      createdAt: new Date(),
    }).save();

    io.to(msg.group).emit("group-message", {
      ...msg,
      createdAt: saved.createdAt,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start HTTPS server
const PORT = process.env.PORT || 443;
httpsServer.listen(PORT, () => {
  console.log(`🚀 HTTPS Server running on port ${PORT}`);
});