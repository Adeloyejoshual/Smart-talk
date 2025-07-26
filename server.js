require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);
app.use(express.static(path.join(__dirname, "public")));

let onlineUsers = new Map();

io.on("connection", socket => {
  let currentUser = "";

  socket.on("user-connected", username => {
    currentUser = username;
    onlineUsers.set(socket.id, username);
    io.emit("online-users", onlineUsers.size);
  });

  socket.on("message", data => {
    io.emit("message", data);
  });

  socket.on("typing", username => {
    socket.broadcast.emit("show-typing", username);
  });

  socket.on("stop-typing", () => {
    socket.broadcast.emit("hide-typing");
  });

  socket.on("broadcast", msg => {
    io.emit("broadcast", msg);
  });

  socket.on("kick", socketId => {
    io.to(socketId).emit("kick", "You were kicked by admin");
    io.sockets.sockets.get(socketId)?.disconnect(true);
  });

  socket.on("registerId", token => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      onlineUsers.set(socket.id, decoded.username);
    } catch (err) {}
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("online-users", onlineUsers.size);
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});