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

        // Send previous chat history to the user
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

    // --- Message delivery & read receipts ---
    socket.on("message-delivered", async ({ messageId, userId }) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "delivered" },
          { new: true }
        );
        io.to(msg.receiver.toString()).emit("message-delivered", msg);
        io.to(msg.sender.toString()).emit("message-delivered", msg);
      } catch (err) {
        console.error("❌ Error updating delivery status:", err);
      }
    });

    socket.on("message-read", async ({ messageId, userId }) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "read" },
          { new: true }
        );
        io.to(msg.receiver.toString()).emit("message-read", msg);
        io.to(msg.sender.toString()).emit("message-read", msg);
      } catch (err) {
        console.error("❌ Error updating read status:", err);
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      console.log("❌ A user disconnected:", socket.id);
    });
  });
};