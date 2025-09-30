// socket.js
const jwt = require("jsonwebtoken");
const Message = require("./models/Message");

const connectedUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    // 🔑 Authenticate using token from socket handshake
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log("❌ No token, disconnecting:", socket.id);
      socket.disconnect();
      return;
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      connectedUsers.set(userId, socket.id);
      console.log(`👤 User authenticated: ${userId}`);
    } catch (err) {
      console.error("❌ Invalid token:", err.message);
      socket.disconnect();
      return;
    }

    // 🟢 Join private room with receiver
    socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
      const roomName = [sender, receiverId].sort().join("-");
      socket.join(roomName);
      console.log(`📥 ${sender} joined room ${roomName}`);
    });

    // ✉️ Handle private message
    socket.on("private message", async (msg) => {
      try {
        // Save if not already saved
        if (!msg._id) {
          const newMessage = new Message({
            sender: msg.sender._id || userId,
            receiver: msg.receiver?._id || msg.receiver || msg.to,
            content: msg.content || "",
            fileUrl: msg.fileUrl || "",
            type: msg.fileType || (msg.fileUrl ? "file" : "text"),
            status: "sent",
          });
          await newMessage.save();

          msg = await newMessage
            .populate("sender", "username avatar")
            .populate("receiver", "username avatar");
        }

        // Send to sender (for confirmation)
        io.to(socket.id).emit("private message", msg);

        // Send to receiver if online
        const receiverId =
          msg.receiver?._id?.toString() || msg.receiver?.toString();
        if (receiverId && connectedUsers.has(receiverId)) {
          const receiverSocketId = connectedUsers.get(receiverId);
          io.to(receiverSocketId).emit("private message", msg);
          console.log(`📤 Delivered message to ${receiverId}`);
        } else {
          console.log("📪 Receiver offline, message stored only in DB");
        }
      } catch (err) {
        console.error("❌ Error handling private message:", err);
      }
    });

    // 🟡 Typing events
    socket.on("typing", ({ to }) => {
      if (connectedUsers.has(to)) {
        io.to(connectedUsers.get(to)).emit("typing");
      }
    });

    socket.on("stop typing", ({ to }) => {
      if (connectedUsers.has(to)) {
        io.to(connectedUsers.get(to)).emit("stop typing");
      }
    });

    // 🔴 Disconnect
    socket.on("disconnect", () => {
      connectedUsers.delete(userId);
      console.log(`❌ User disconnected: ${userId}`);
    });
  });
};