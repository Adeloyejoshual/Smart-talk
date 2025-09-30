const Message = require("./models/Message");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // --- Join private room using userId ---
    socket.on("join", async (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their private room`);

      // --- Load previous messages for this user ---
      try {
        const messages = await Message.find({
          $or: [{ sender: userId }, { receiver: userId }],
        })
          .sort({ createdAt: 1 })
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        socket.emit("chatHistory", messages);
      } catch (error) {
        console.error("❌ Error loading chat history:", error);
      }
    });

    // --- Private message handler ---
    socket.on("privateMessage", async (msg) => {
      const {
        senderId,
        receiverId,
        content,
        replyTo = null,
        isForwarded = false,
        fileUrl = "",
      } = msg;

      if (!receiverId || (!content && !fileUrl)) return;

      try {
        // Save message to DB
        const newMessage = new Message({
          sender: senderId,
          receiver: receiverId,
          content,
          fileUrl,
          replyTo,
          isForwarded,
          status: "sent",
          type: fileUrl ? "file" : "text",
        });

        await newMessage.save();

        // Populate sender/receiver info
        const populatedMessage = await newMessage
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        // Emit message to receiver
        io.to(receiverId).emit("privateMessage", populatedMessage);

        // Confirm message sent to sender
        socket.emit("privateMessageSent", populatedMessage);

        console.log(`📩 Message from ${senderId} to ${receiverId} saved and emitted`);
      } catch (error) {
        console.error("❌ Error saving/sending message:", error);
      }
    });

    // --- Typing indicator ---
    socket.on("typing", ({ receiverId, senderId }) => {
      if (receiverId) io.to(receiverId).emit("typing", { senderId });
    });

    // --- Delivery & read receipts ---
    socket.on("message-delivered", ({ messageId, userId }) => {
      io.emit("message-delivered", { messageId, userId });
    });

    socket.on("message-read", ({ messageId, userId }) => {
      io.emit("message-read", { messageId, userId });
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      console.log("❌ A user disconnected:", socket.id);
    });
  });
};