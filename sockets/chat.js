const Message = require("../models/Message");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    // Join private room
    socket.on("join", (userId) => {
      socket.join(userId);
    });

    // Join group room
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
    });

    // Handle private messages
    socket.on("privateMessage", ({ senderId, receiverId, content }) => {
      const message = {
        senderId,
        receiverId,
        content,
        timestamp: new Date(),
        status: "delivered"
      };

      // Emit to receiver only
      socket.to(receiverId).emit("privateMessage", message);
    });

    // Handle group messages
    socket.on("group-message", async (msg) => {
      const { sender, group, text } = msg;

      // Save to DB
      const saved = await Message.create({
        sender,
        group,
        text,
        createdAt: new Date()
      });

      // Emit to everyone in group
      io.to(group).emit("group-message", saved);
    });

    // Disconnect cleanup
    socket.on("disconnecting", () => {
      const rooms = [...socket.rooms].filter(r => r !== socket.id);
      rooms.forEach(room => {
        socket.to(room).emit("message", {
          username: "System",
          text: "A user has left the chat.",
          time: new Date()
        });
      });
    });
  });
};