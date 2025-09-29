const Message = require("./models/Message"); // Adjust path if needed

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
      const { senderId, receiverId, content, replyTo = null, isForwarded = false, fileUrl = "" } = msg;
      if (!receiverId || (!content && !fileUrl)) return;

      try {
        // Save message in DB
        const newMessage = new Message({
          sender: senderId,
          recipient: receiverId,
          content,
          fileUrl,
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
          fileUrl,
          replyTo,
          timestamp: newMessage.createdAt,
          isForwarded,
        });

        // Confirm to sender
        socket.emit("privateMessageSent", {
          _id: newMessage._id,
          receiverId,
          content,
          fileUrl,
          replyTo,
          timestamp: newMessage.createdAt,
          isForwarded,
        });

        console.log(`📩 Private message saved and sent from ${senderId} to ${receiverId}`);
      } catch (error) {
        console.error("❌ Error saving/sending private message:", error);
      }
    });

    // Typing indicators
    socket.on("typing", ({ receiverId, senderId }) => {
      if (receiverId) io.to(receiverId).emit("typing", { senderId });
    });

    // Delivery/read receipts
    socket.on("message-delivered", ({ messageId, userId }) => {
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