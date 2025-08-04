const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const User = require("./models/User");
const Group = require("./models/Group");

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

    // Join group rooms
    Group.find({ members: userId }).then((groups) => {
      groups.forEach((group) => {
        socket.join(group._id.toString());
      });
    });

    // 1-on-1 typing
    socket.on("typing", ({ to }) => {
      io.to(to).emit("typing", { from: userId });
    });

    // Private message
    socket.on("send_message", async ({ to, content }) => {
      const msg = await Message.create({
        sender: userId,
        recipient: to,
        content,
      });

      io.to(to).emit("receive_message", msg);
      io.to(userId).emit("message_sent", msg);
    });

    // Group message
    socket.on("send_group_message", async ({ groupId, content }) => {
      const msg = await Message.create({
        sender: userId,
        group: groupId,
        content,
      });

      io.to(groupId).emit("receive_group_message", msg);
      io.to(userId).emit("message_sent", msg);
    });
  });
}

module.exports = socketHandler;