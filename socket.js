// socket.js
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 A user connected");

    // Join a group chat room
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
      console.log(`🟢 User joined group: ${groupId}`);
    });

    // Broadcast message to all in the group
    socket.on("group-message", (msg) => {
      const groupId = msg.group;
      if (groupId) {
        io.to(groupId).emit("group-message", msg);
        console.log(`📤 Broadcast to group ${groupId}: ${msg.text}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 A user disconnected");
    });
  });
};