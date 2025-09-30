const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Message = require("./models/Message");

const connectedUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // --- Authenticate user ---
    const token = socket.handshake.auth?.token;
    if (!token) return socket.disconnect();

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      connectedUsers.set(userId, socket.id);

      // Mark user online in DB
      await User.findByIdAndUpdate(userId, { online: true });
      io.emit("userOnline", { userId, online: true });
    } catch (err) {
      return socket.disconnect();
    }

    // --- Join private room ---
    socket.on("joinPrivateRoom", ({ sender, receiverId }) => {
      const roomName = [sender, receiverId].sort().join("_");
      socket.join(roomName);
      socket.data.roomId = roomName;
    });

    // --- Private messaging ---
    socket.on("private message", async (msg) => {
      try {
        // Save message to DB
        const newMsg = new Message({
          sender: userId,
          receiver: msg.receiverId,
          content: msg.content || "",
          type: msg.fileType || (msg.fileUrl ? "file" : "text"),
          fileUrl: msg.fileUrl || "",
          status: "sent",
        });
        await newMsg.save();

        const populatedMsg = await newMsg.populate("sender", "username avatar")
                                         .populate("receiver", "username avatar");

        // Emit to sender
        io.to(socket.id).emit("private message", {
          _id: populatedMsg._id,
          senderId: populatedMsg.sender._id,
          senderName: populatedMsg.sender.username,
          receiverId: populatedMsg.receiver._id,
          content: populatedMsg.content,
          file: populatedMsg.fileUrl,
          fileType: populatedMsg.type,
          timestamp: populatedMsg.createdAt,
        });

        // Emit to receiver if online
        const receiverSocket = connectedUsers.get(msg.receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit("private message", {
            _id: populatedMsg._id,
            senderId: populatedMsg.sender._id,
            senderName: populatedMsg.sender.username,
            receiverId: populatedMsg.receiver._id,
            content: populatedMsg.content,
            file: populatedMsg.fileUrl,
            fileType: populatedMsg.type,
            timestamp: populatedMsg.createdAt,
          });
        }
      } catch (err) {
        console.error("❌ Error sending private message:", err);
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", async () => {
      connectedUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() }).catch(console.error);
      io.emit("userOnline", { userId, online: false, lastSeen: new Date() });
    });
  });
};