// server.js
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
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// ---------- API Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// ---------- HTML Routes ----------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "public/home.html")));
app.get("/private-chat", (req, res) => res.sendFile(path.join(__dirname, "public/private-chat.html")));

// ---------- Socket.IO Setup ----------
const onlineUsers = new Map(); // email -> socketId

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Token required"));
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = user; // { email, id, ... }
    next();
  });
});

io.on("connection", async (socket) => {
  const userEmail = socket.user.email;
  onlineUsers.set(userEmail, socket.id);

  await User.findOneAndUpdate({ email: userEmail }, { online: true }).catch(console.error);
  console.log(`🔌 User connected: ${userEmail} (${socket.id})`);

  // Join private room
  socket.on("joinPrivateRoom", ({ receiverEmail }) => {
    const roomId = [userEmail, receiverEmail].sort().join("_");
    socket.join(roomId);
    socket.data.roomId = roomId;
  });

  // Send private message
  socket.on("private message", async ({ toEmail, content, fileUrl, fileType = "text" }) => {
    try {
      if (!toEmail) return console.error("❌ Receiver email required");

      const newMsg = new Message({
        senderEmail: userEmail,
        receiverEmail: toEmail,
        content: content || "",
        fileUrl: fileUrl || "",
        fileType,
      });
      await newMsg.save();

      // Emit to sender
      socket.emit("private message", newMsg);

      // Emit to receiver if online
      const toSocketId = onlineUsers.get(toEmail);
      if (toSocketId) io.to(toSocketId).emit("private message", newMsg);
    } catch (err) {
      console.error("❌ Error sending private message:", err);
    }
  });

  // Typing indicators
  socket.on("typing", ({ toEmail }) => {
    const toSocketId = onlineUsers.get(toEmail);
    if (toSocketId) io.to(toSocketId).emit("typing", { fromEmail: userEmail });
  });
  socket.on("stop typing", ({ toEmail }) => {
    const toSocketId = onlineUsers.get(toEmail);
    if (toSocketId) io.to(toSocketId).emit("stop typing", { fromEmail: userEmail });
  });

  // ------------------- DISCONNECT -------------------
  socket.on("disconnect", async () => {
    onlineUsers.delete(userEmail);
    await User.findOneAndUpdate({ email: userEmail }, { online: false, lastSeen: new Date() }).catch(console.error);
    console.log(`❌ User disconnected: ${userEmail}`);
  });
});

// ---------- FILE UPLOAD ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "public/uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/api/messages/file", upload.single("file"), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderEmail = decoded.email;
    const { recipientEmail } = req.body;

    if (!recipientEmail || !req.file) return res.status(400).json({ message: "Missing recipient or file" });

    const newMsg = new Message({
      senderEmail,
      receiverEmail: recipientEmail,
      fileUrl: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype.startsWith("image/") ? "image" : "file",
    });
    await newMsg.save();

    socket.emit("private message", newMsg);

    const toSocketId = onlineUsers.get(recipientEmail);
    if (toSocketId) io.to(toSocketId).emit("private message", newMsg);

    res.json(newMsg);
  } catch (err) {
    console.error("❌ Upload failed:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ---------- MongoDB ----------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ---------- Start Server ----------
server.listen(process.env.PORT || 10000, () => console.log("🚀 Server running"));