// socket.js
const Message = require("./models/Message");
const User = require("./models/User");

module.exports = (io) => {
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // ---------------- JOIN ----------------
    socket.on("join", async (userId) => {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);

      // Mark user online in DB
      await User.findByIdAndUpdate(userId, { online: true }).catch(console.error);

      console.log(`👤 User ${userId} joined (socket ${socket.id})`);

      // Send chat history (all messages for this user)
      try {
        const messages = await Message.find({
          $or: [{ sender: userId }, { receiver: userId }],
        })
          .sort({ createdAt: 1 }) // oldest first
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        socket.emit("chatHistory", messages);
      } catch (err) {
        console.error("❌ Error loading history:", err);
      }
    });

    // ---------------- PRIVATE MESSAGE ----------------
    socket.on("private message", async ({ senderId, receiverId, content, type, fileUrl, replyTo = null, isForwarded = false }) => {
      try {
        const message = new Message({
          sender: senderId,
          receiver: receiverId,
          content: content || "",
          type: type || "text",
          fileUrl: fileUrl || "",
          replyTo,
          isForwarded,
          fileType: type === "text" ? "text" : type,
          status: "sent",
        });

        await message.save();

        const populated = await message
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        // Send to receiver if online
        const receiverSocket = onlineUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit("newMessage", populated);
        }

        // Always send back to sender
        socket.emit("newMessage", populated);

        console.log(`💬 Message saved & delivered from ${senderId} → ${receiverId}`);
      } catch (err) {
        console.error("❌ Error saving/sending message:", err);
      }
    });

    // ---------------- DELIVERY RECEIPT ----------------
    socket.on("message-delivered", async ({ messageId }) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "delivered" },
          { new: true }
        )
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        if (msg) {
          const senderSocket = onlineUsers.get(msg.sender._id.toString());
          const receiverSocket = onlineUsers.get(msg.receiver._id.toString());

          if (senderSocket) io.to(senderSocket).emit("message-delivered", msg);
          if (receiverSocket) io.to(receiverSocket).emit("message-delivered", msg);
        }
      } catch (err) {
        console.error("❌ Delivery update failed:", err);
      }
    });

    // ---------------- READ RECEIPT ----------------
    socket.on("message-read", async ({ messageId }) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "read" },
          { new: true }
        )
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        if (msg) {
          const senderSocket = onlineUsers.get(msg.sender._id.toString());
          const receiverSocket = onlineUsers.get(msg.receiver._id.toString());

          if (senderSocket) io.to(senderSocket).emit("message-read", msg);
          if (receiverSocket) io.to(receiverSocket).emit("message-read", msg);
        }
      } catch (err) {
        console.error("❌ Read update failed:", err);
      }
    });

    // ---------------- TYPING INDICATORS ----------------
    socket.on("typing", ({ to }) => {
      const receiverSocket = onlineUsers.get(to);
      if (receiverSocket) {
        io.to(receiverSocket).emit("typing", { from: socket.userId });
      }
    });

    socket.on("stop typing", ({ to }) => {
      const receiverSocket = onlineUsers.get(to);
      if (receiverSocket) {
        io.to(receiverSocket).emit("stop typing", { from: socket.userId });
      }
    });

    // ---------------- DISCONNECT ----------------
    socket.on("disconnect", async () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        await User.findByIdAndUpdate(socket.userId, { online: false }).catch(console.error);
        console.log(`❌ User ${socket.userId} disconnected`);
      }
    });
  });
};