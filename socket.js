const Message = require("./models/Message"); // Ensure path is correct

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // Each user joins their private room (using userId)
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their private room`);
    });

    // ---------------- PRIVATE MESSAGE ----------------
    socket.on("privateMessage", async (msg) => {
      const { senderId, receiverId, content = "", fileUrl = "", type = "text" } = msg;
      if (!receiverId || (!content && !fileUrl)) return;

      try {
        // Save message in DB
        const newMessage = new Message({
          sender: senderId,
          receiver: receiverId,  // Make sure your Message model uses `receiver`
          content,
          fileUrl,
          type,
          status: "sent",
        });
        await newMessage.save();

        // Populate sender/receiver for frontend
        const populatedMessage = await newMessage
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar")
          .execPopulate();

        // Emit to receiver's room
        io.to(receiverId).emit("privateMessage", populatedMessage);

        // Emit back to sender (to confirm/send locally)
        socket.emit("privateMessageSent", populatedMessage);

        console.log(`📩 Private message saved and sent from ${senderId} to ${receiverId}`);
      } catch (err) {
        console.error("❌ Error saving/sending private message:", err);
      }
    });

    // ---------------- TYPING INDICATOR ----------------
    socket.on("typing", ({ senderId, receiverId }) => {
      if (receiverId) io.to(receiverId).emit("typing", { senderId });
    });

    // ---------------- DELIVERY / READ RECEIPTS ----------------
    socket.on("message-delivered", ({ messageId, userId }) => {
      io.emit("message-delivered", { messageId, userId });
    });

    socket.on("message-read", ({ messageId, userId }) => {
      io.emit("message-read", { messageId, userId });
    });

    // ---------------- DISCONNECT ----------------
    socket.on("disconnect", () => {
      console.log("❌ A user disconnected:", socket.id);
    });
  });
};