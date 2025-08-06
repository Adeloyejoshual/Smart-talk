// socket.js
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // Join private room using userId
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their private room`);
    });

    // Private message
    socket.on("privateMessage", (msg) => {
      const { senderId, receiverId, content } = msg;
      if (!receiverId || !content) return;

      io.to(receiverId).emit("privateMessage", {
        senderId,
        content,
        timestamp: new Date().toISOString(),
      });

      console.log(`📩 Private message from ${senderId} to ${receiverId}: ${content}`);
    });

    // Group chat join
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
      console.log(`🟢 User joined group: ${groupId}`);
    });

    // Group message broadcast
    socket.on("group-message", (msg) => {
      const groupId = msg.group;
      if (groupId) {
        io.to(groupId).emit("group-message", msg);
        console.log(`📤 Broadcast to group ${groupId}: ${msg.text}`);
      }
    });

    // Typing indicators (optional)
    socket.on("typing", ({ receiverId, senderId }) => {
      io.to(receiverId).emit("typing", { senderId });
    });

    socket.on("disconnect", () => {
      console.log("❌ A user disconnected:", socket.id);
    });
  });
};