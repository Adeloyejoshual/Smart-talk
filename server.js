// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Secure ENV check
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error("❌ Missing JWT_SECRET or MONGO_URI in .env file");
  process.exit(1);
}

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => {
  console.error("❌ MongoDB connection failed:", err.message);
  process.exit(1);
});

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");
const settingsRoutes = require("./routes/settings");
const verifyToken = require("./middleware/verifyToken");

app.use("/api/auth", authRoutes);
app.use("/api/users", verifyToken, userRoutes);
app.use("/api/messages", verifyToken, messageRoutes);
app.use("/api/settings", verifyToken, settingsRoutes);

// HTML token protection
function verifyHTMLToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.redirect("/");
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.redirect("/");
  }
}

// Protected pages
app.get("/home.html", verifyHTMLToken, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "home.html"))
);
app.get("/chat.html", verifyHTMLToken, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "chat.html"))
);
app.get("/profile.html", verifyHTMLToken, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "profile.html"))
);
app.get("/settings.html", verifyHTMLToken, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "settings.html"))
);
app.get("/notification.html", verifyHTMLToken, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "notification.html"))
);

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Online users
const onlineUsers = new Map();
const Chat = require("./models/Chat");

io.on("connection", (socket) => {
  console.log("🔌 A user connected:", socket.id);

  socket.on("userOnline", (userId) => {
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`✅ User online: ${userId}`);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`❌ User offline: ${userId}`);
        break;
      }
    }
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });

  // 📤 Send message
  socket.on("privateMessage", async ({ senderId, receiverId, content, fileUrl }) => {
    if (!senderId || !receiverId || (!content && !fileUrl)) return;

    const chat = new Chat({
      sender: senderId,
      receiver: receiverId,
      message: content,
      fileUrl,
      status: "sent",
      timestamp: new Date()
    });

    await chat.save();

    const receiverSocket = onlineUsers.get(receiverId);
    const senderSocket = onlineUsers.get(senderId);

    if (receiverSocket) {
      io.to(receiverSocket).emit("newMessage", {
        ...chat._doc,
        status: "delivered"
      });

      // Update to 'delivered'
      await Chat.findByIdAndUpdate(chat._id, { status: "delivered" });
    }

    // Send to sender
    if (senderSocket) {
      io.to(senderSocket).emit("newMessage", {
        ...chat._doc,
        status: receiverSocket ? "delivered" : "sent"
      });
    }
  });

  // ✅ Read receipt when user opens the chat
  socket.on("markAsRead", async ({ senderId, receiverId }) => {
    await Chat.updateMany(
      {
        sender: senderId,
        receiver: receiverId,
        status: { $ne: "read" }
      },
      { status: "read" }
    );

    const senderSocket = onlineUsers.get(senderId);
    if (senderSocket) {
      io.to(senderSocket).emit("messagesRead", { by: receiverId });
    }
  });

  socket.on("typing", ({ senderId, receiverId, isTyping }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", {
        senderId,
        isTyping
      });
    }
  });
});

// ✅ Remove friend
router.delete("/remove-friend/:friendId", authMiddleware, async (req, res) => {
  const { friendId } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Not in your friend list" });
    }

    user.friends = user.friends.filter(f => f.toString() !== friendId);
    await user.save();

    res.json({ message: "Friend removed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove friend" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});