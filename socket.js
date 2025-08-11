// socket.js
const Message = require("./models/Message"); // Adjust the path as needed

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // Join private room using userId
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their private room`);
    });

    // Private message with DB save
    socket.on("privateMessage", async (msg) => {
      const { senderId, receiverId, content, replyTo = null, isForwarded = false } = msg;
      if (!receiverId || !content) return;

      try {
        // Save message in DB
        const newMessage = new Message({
          sender: senderId,
          recipient: receiverId,
          content,
          replyTo,
          isForwarded,
          status: "sent",
          type: "text",
        });
        await newMessage.save();

        // Emit to receiver's room
        io.to(receiverId).emit("privateMessage", {
          _id: newMessage._id,
          senderId,
          content,
          replyTo,
          timestamp: newMessage.createdAt,
          isForwarded,
        });

        // Optionally emit back to sender to confirm delivery
        socket.emit("privateMessageSent", {
          _id: newMessage._id,
          receiverId,
          content,
          replyTo,
          timestamp: newMessage.createdAt,
          isForwarded,
        });

        console.log(`📩 Private message saved and sent from ${senderId} to ${receiverId}`);
      } catch (error) {
        console.error("❌ Error saving/sending private message:", error);
      }
    });

    // Group chat join
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
      console.log(`🟢 User joined group: ${groupId}`);
    });

    // Group message broadcast with DB save
    socket.on("group-message", async (msg) => {
      const { group, senderId, text, replyTo = null, isForwarded = false } = msg;
      if (!group || !text) return;

      try {
        // Save group message in DB
        const newMessage = new Message({
          sender: senderId,
          group,
          content: text,
          replyTo,
          isForwarded,
          status: "sent",
          type: "text",
        });
        await newMessage.save();

        io.to(group).emit("group-message", {
          _id: newMessage._id,
          group,
          senderId,
          text,
          replyTo,
          timestamp: newMessage.createdAt,
          isForwarded,
        });

        console.log(`📤 Group message saved and broadcast in group ${group}`);
      } catch (error) {
        console.error("❌ Error saving/broadcasting group message:", error);
      }
    });

    // Typing indicators (optional)
    socket.on("typing", ({ receiverId, senderId }) => {
      if (receiverId) {
        io.to(receiverId).emit("typing", { senderId });
      }
    });

    // Delivery/read receipts (example)
    socket.on("message-delivered", ({ messageId, userId }) => {
      // Broadcast delivery receipt to sender or group members
      io.emit("message-delivered", { messageId, userId });
    });

    socket.on("message-read", ({ messageId, userId }) => {
      io.emit("message-read", { messageId, userId });
    });

    socket.on("disconnect", () => {
      console.log("❌ A user disconnected:", socket.id);
    });
  });
};