const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const User = require("./models/User");

function socketHandler(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Unauthorized"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = await User.findById(decoded.id);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    socket.join(userId);
    console.log(`User ${userId} connected`);

    // Typing event
    socket.on("typing", ({ to }) => {
      io.to(to).emit("typing", { from: userId });
    });

    // Send message
    socket.on("send_message", async ({ to, content }) => {
      const message = await Message.create({
        sender: userId,
        recipient: to,
        content,
        status: "sent",
      });

      io.to(to).emit("receive_message", message);
      io.to(userId).emit("message_sent", message);
    });

    // Read receipt
    socket.on("mark_read", async ({ messageId }) => {
      const msg = await Message.findByIdAndUpdate(messageId, { status: "read" }, { new: true });
      io.to(msg.sender.toString()).emit("message_read", { messageId });
    });
  });
}

module.exports = socketHandler;