const Message = require("../models/Message");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Join user to a room
    socket.on("joinRoom", ({ room, username }) => {
      socket.join(room);
      socket.to(room).emit("message", {
        username: "System",
        text: `${username} has joined the room.`,
        time: new Date(),
      });
    });

    // Handle incoming chat messages
    socket.on("chatMessage", async ({ room, username, text }) => {
      const message = new Message({ username, text, time: new Date() });
      await message.save();

      io.to(room).emit("message", {
        username,
        text,
        time: message.time,
      });
    });

    // Notify room on user disconnect
    socket.on("disconnecting", () => {
      const rooms = [...socket.rooms].filter((r) => r !== socket.id);
      rooms.forEach((room) => {
        socket.to(room).emit("message", {
          username: "System",
          text: "A user has left the chat.",
          time: new Date(),
        });
      });
    });
  });
};