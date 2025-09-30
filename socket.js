// socket.js
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Message = require("./models/Message");

const connectedUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // --- Authenticate user ---
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log("❌ No token, disconnecting:", socket.id);
      return socket.disconnect();
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      connectedUsers.set(userId, socket.id);

      // Mark user online in DB
      await User.findByIdAndUpdate(userId, { online: true });
      console.log(`👤 User authenticated & online: ${userId}`);

      // Broadcast online status
      io.emit("userOnline", { userId, online: true });
    } catch (err) {
      console.error("❌ Invalid token:", err.message);
      return socket.disconnect();
    }

    // --- Join private room ---
    socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
      const roomName = [sender, receiverId].sort().join("_");
      socket.join(roomName);
      socket.data.roomId = roomName;
      console.log(`📥 User ${sender} joined room ${roomName}`);
    });

    // --- Private messaging ---
    socket.on("private message", async (msg) => {
      try {
        // Save message if not saved yet
        if (!msg._id) {
          const newMessage = new Message({
            sender: msg.sender?._id || userId,
            receiver: msg.receiver?._id || msg.receiver || msg.to,
            content: msg.content || "",
            fileUrl: msg.fileUrl || "",
            type: msg.fileType || (msg.fileUrl ? "file" : "text"),
            status: "sent",
          });
          await newMessage.save();

          // Populate sender/receiver info
          msg = await newMessage
            .populate("sender", "username avatar")
            .populate("receiver", "username avatar");
        }

        // Send to sender (confirmation)
        io.to(socket.id).emit("private message", msg);

        // Send to receiver if online
        const receiverId = msg.receiver?._id?.toString() || msg.receiver?.toString();
        if (receiverId && connectedUsers.has(receiverId)) {
          const receiverSocketId = connectedUsers.get(receiverId);
          io.to(receiverSocketId).emit("private message", msg);
          console.log(`📤 Delivered message to ${receiverId}`);
        } else {
          console.log("📪 Receiver offline, message stored in DB");
        }
      } catch (err) {
        console.error("❌ Error handling private message:", err);
      }
    });

    // --- Typing indicators ---
    socket.on("typing", ({ to }) => {
      if (connectedUsers.has(to)) {
        io.to(connectedUsers.get(to)).emit("typing", { from: userId });
      }
    });

    socket.on("stop typing", ({ to }) => {
      if (connectedUsers.has(to)) {
        io.to(connectedUsers.get(to)).emit("stop typing", { from: userId });
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", async () => {
      connectedUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() }).catch(console.error);
      console.log(`❌ User disconnected: ${userId}`);

      // Broadcast offline status
      io.emit("userOnline", { userId, online: false, lastSeen: new Date() });
    });
  });
};