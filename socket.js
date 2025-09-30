// socket.js
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Message = require("./models/Message");

const connectedUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // ---------- AUTHENTICATE USER ----------
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log("❌ No token, disconnecting socket:", socket.id);
      return socket.disconnect();
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      connectedUsers.set(userId, socket.id);

      // Mark user online
      await User.findByIdAndUpdate(userId, { online: true });

      // Notify others
      io.emit("userOnline", { userId, online: true });
      console.log(`👤 User authenticated & online: ${userId}`);
    } catch (err) {
      console.error("❌ Invalid token:", err.message);
      return socket.disconnect();
    }

    // ---------- JOIN PRIVATE ROOM ----------
    socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
      const roomId = [sender, receiverId].sort().join("_");
      socket.join(roomId);
      socket.data.roomId = roomId;
      console.log(`📥 User ${sender} joined room ${roomId}`);
    });

    // ---------- PRIVATE MESSAGE ----------
    socket.on("private message", async (msg) => {
      try {
        // If message not yet saved, save it
        if (!msg._id) {
          const newMessage = new Message({
            sender: msg.sender?._id || userId,
            receiver: msg.receiver?._id || msg.receiver || msg.to,
            content: msg.content || "",
            fileUrl: msg.fileUrl || "",
            fileType: msg.fileType || (msg.fileUrl ? "file" : "text"),
            status: "sent",
          });

          await newMessage.save();

          // Populate sender info
          msg = await newMessage.populate("sender", "username avatar");
        }

        const receiverId = msg.receiver?._id?.toString() || msg.receiver?.toString();
        const roomId = [userId, receiverId].sort().join("_");

        // Emit to sender and receiver via room
        io.to(roomId).emit("private message", msg);
        console.log(`📤 Message sent in room ${roomId}`);
      } catch (err) {
        console.error("❌ Error sending private message:", err);
      }
    });

    // ---------- TYPING INDICATORS ----------
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

    // ---------- DISCONNECT ----------
    socket.on("disconnect", async () => {
      connectedUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() }).catch(console.error);
      console.log(`❌ User disconnected: ${userId}`);

      // Broadcast offline status
      io.emit("userOnline", { userId, online: false, lastSeen: new Date() });
    });
  });
};