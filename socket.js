const Message = require("./models/Message");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // --- Join room with userId & load history ---
    socket.on("join", async (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their room`);

      try {
        // Send full chat history for this user
        const messages = await Message.find({
          $or: [{ sender: userId }, { receiver: userId }],
        })
          .sort({ createdAt: 1 }) // oldest first
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        socket.emit("chatHistory", messages);
      } catch (err) {
        console.error("❌ Error loading history:", err);
      }
    });

    // --- Private messaging ---
    socket.on("privateMessage", async (msg) => {
      const {
        senderId,
        receiverId,
        content,
        fileUrl = "",
        replyTo = null,
        isForwarded = false,
      } = msg;

      if (!receiverId || (!content && !fileUrl)) return;

      try {
        // Save new message
        const newMessage = new Message({
          sender: senderId,
          receiver: receiverId,
          content,
          fileUrl,
          replyTo,
          isForwarded,
          type: fileUrl ? "file" : "text",
          status: "sent",
        });

        await newMessage.save();

        // Populate info
        const populated = await newMessage
          .populate("sender", "username avatar")
          .populate("receiver", "username avatar");

        // Emit to both users
        io.to(receiverId).emit("newMessage", populated); // receiver sees instantly
        socket.emit("newMessage", populated); // sender sees instantly

        console.log(`📩 ${senderId} ➝ ${receiverId}: Message saved and sent`);
      } catch (err) {
        console.error("❌ Error saving message:", err);
      }
    });

    // --- Typing indicator ---
    socket.on("typing", ({ receiverId, senderId }) => {
      if (receiverId) {
        io.to(receiverId).emit("typing", { senderId });
      }
    });

    // --- Delivery receipt ---
    socket.on("message-delivered", async ({ messageId }) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "delivered" },
          { new: true }
        );
        if (msg) {
          io.to(msg.receiver.toString()).emit("message-delivered", msg);
          io.to(msg.sender.toString()).emit("message-delivered", msg);
        }
      } catch (err) {
        console.error("❌ Delivery update failed:", err);
      }
    });

    // --- Read receipt ---
    socket.on("message-read", async ({ messageId }) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "read" },
          { new: true }
        );
        if (msg) {
          io.to(msg.receiver.toString()).emit("message-read", msg);
          io.to(msg.sender.toString()).emit("message-read", msg);
        }
      } catch (err) {
        console.error("❌ Read update failed:", err);
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      console.log("❌ A user disconnected:", socket.id);
    });
  });
};