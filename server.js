require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");
const authRoutes = require("./routes/auth");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/api", authRoutes);

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("Mongo Error:", err));

// WebSocket Chat
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("userOnline", (username) => {
    onlineUsers[socket.id] = username;
    io.emit("updateOnlineUsers", Object.values(onlineUsers));
  });

  socket.on("chatMessage", (msg) => {
    io.emit("chatMessage", msg);
  });

  socket.on("disconnect", () => {
    delete onlineUsers[socket.id];
    io.emit("updateOnlineUsers", Object.values(onlineUsers));
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));