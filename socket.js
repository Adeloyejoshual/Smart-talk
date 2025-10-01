const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Message = require("./models/Message");

const connectedUsers = new Map(); // email -> socketId

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // --- Authenticate user ---
    const token = socket.handshake.auth?.token;
    if (!token) return socket.disconnect();

    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email; // use email as identifier
      if (!userEmail) throw new Error("Email missing in token");
      connectedUsers.set(userEmail, socket.id);

      // Mark user online
      await User.findOneAndUpdate({ email: userEmail }, { online: true });
      io.emit("userOnline", { email: userEmail, online: true });
      console.log(`👤 User authenticated & online: ${userEmail}`);
    } catch (err) {
      console.error("❌ Invalid token:", err.message);
      return socket.disconnect();
    }

    // --- Join private room ---
    socket.on("joinPrivateRoom", ({ receiverEmail }) => {
      const roomName = [userEmail, receiverEmail].sort().join("_");
      socket.join(roomName);
      socket.data.roomId = roomName;
      console.log(`📥 User ${userEmail} joined room ${roomName}`);
    });

    // --- Private messaging ---
    socket.on("private message", async (msg) => {
  try {
    const receiverEmail = msg.receiverEmail;
    if (!receiverEmail) return console.error("❌ receiverEmail is required");
    // Save message to DB
    const newMessage = new Message({
      senderEmail: userEmail,
      receiverEmail,
      content: msg.content || "",
      type: msg.type || (msg.fileUrl ? "file" : "text"),
      fileUrl: msg.fileUrl || "",
      status: "sent",
      username: msg.username // Add username to message object
    });
    await newMessage.save();
    // Emit to sender
    io.to(socket.id).emit("private message", newMessage);
    // Emit to receiver if online
    if (connectedUsers.has(receiverEmail)) {
      io.to(connectedUsers.get(receiverEmail)).emit("private message", newMessage);
    }
  } catch (err) {
    console.error("❌ Error sending private message:", err);
  }
});


    // --- Typing indicators ---
    socket.on("typing", ({ to }) => {
      if (connectedUsers.has(to)) io.to(connectedUsers.get(to)).emit("typing", { from: userEmail });
    });
    socket.on("stopTyping", ({ to }) => {
      if (connectedUsers.has(to)) io.to(connectedUsers.get(to)).emit("stopTyping", { from: userEmail });
    });

    // --- Disconnect ---
    socket.on("disconnect", async () => {
      connectedUsers.delete(userEmail);
      await User.findOneAndUpdate({ email: userEmail }, { online: false, lastSeen: new Date() });
      io.emit("userOnline", { email: userEmail, online: false, lastSeen: new Date() });
      console.log(`❌ User disconnected: ${userEmail}`);
    });
  });
};