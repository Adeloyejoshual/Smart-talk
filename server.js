const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");
const multer = require("multer");

dotenv.config();

// Models
const User = require("./models/User");
const Message = require("./models/Message");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET","POST"] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// HTML routes
app.get("/", (req,res) => res.sendFile(path.join(__dirname,"public/login.html")));
app.get("/home", (req,res) => res.sendFile(path.join(__dirname,"public/home.html")));
app.get("/private-chat", (req,res) => res.sendFile(path.join(__dirname,"public/private-chat.html")));

const onlineUsers = new Map();

// Socket JWT middleware
io.use((socket,next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Token required"));
  jwt.verify(token, process.env.JWT_SECRET, (err,user) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = user;
    next();
  });
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);

  User.findByIdAndUpdate(userId, { online:true }).catch(console.error);

  socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
    const roomId = [sender, receiverId].sort().join("_");
    socket.join(roomId);
    socket.data.roomId = roomId;
  });

  socket.on("private message", async ({ to, message, fileUrl, fileType }) => {
    try {
      const newMsg = new Message({
        sender: userId,
        receiver: to,
        content: message || "",
        fileUrl: fileUrl || "",
        fileType: fileType || "text",
      });
      await newMsg.save();

      const payload = {
        _id: newMsg._id,
        sender: { id: userId, username: socket.user.username },
        receiver: to,
        content: newMsg.content,
        fileUrl: newMsg.fileUrl,
        fileType: newMsg.fileType,
        createdAt: newMsg.createdAt,
      };

      // send to receiver if online
      const toSocketId = onlineUsers.get(to);
      if (toSocketId) io.to(toSocketId).emit("private message", payload);

      // echo to sender
      socket.emit("private message", payload);
    } catch (err) { console.error(err); }
  });

  socket.on("typing", ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) io.to(toSocketId).emit("typing", { from: userId });
  });

  socket.on("stop typing", ({ to }) => {
    const toSocketId = onlineUsers.get(to);
    if (toSocketId) io.to(toSocketId).emit("stop typing", { from: userId });
  });

  socket.on("disconnect", async () => {
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, { online:false }).catch(console.error);
  });
});

// File upload
const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null,path.join(__dirname,"public/uploads")),
  filename: (req,file,cb) => cb(null,Date.now()+"-"+file.originalname),
});
const upload = multer({ storage });

app.post("/api/messages/file", upload.single("file"), async (req,res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.id;
    const { recipient } = req.body;
    if (!recipient || !req.file) return res.status(400).json({ message:"Missing recipient or file" });

    const newMsg = new Message({
      sender: senderId,
      receiver: recipient,
      fileUrl: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype.startsWith("image/") ? "image" : "file",
    });
    await newMsg.save();

    const payload = {
      _id: newMsg._id,
      sender: { id: senderId, username: decoded.username },
      receiver: recipient,
      content: newMsg.content,
      fileUrl: newMsg.fileUrl,
      fileType: newMsg.fileType,
      createdAt: newMsg.createdAt,
    };

    // emit to receiver
    const toSocketId = onlineUsers.get(recipient);
    if (toSocketId) io.to(toSocketId).emit("private message", payload);

    res.json(payload);
  } catch (err) { console.error(err); res.status(500).json({ message:"Upload failed" }); }
});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:",err));

server.listen(process.env.PORT||10000, () => console.log("🚀 Server running"));