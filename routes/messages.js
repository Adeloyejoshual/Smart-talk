const express = require("express"); const router = express.Router(); const multer = require("multer"); const cloudinary = require("cloudinary").v2; const dotenv = require("dotenv"); const Message = require("../models/Message"); const auth = require("../middleware/verifyToken"); const uploadToCloudinary = require("../utils/cloudinaryUpload");

dotenv.config();

// 🔐 Configure Cloudinary cloudinary.config({ cloud_name: process.env.CLOUD_NAME, api_key: process.env.CLOUD_API_KEY, api_secret: process.env.CLOUD_API_SECRET, });

// 📦 Use multer in-memory storage (buffer) const storage = multer.memoryStorage(); const upload = multer({ storage });

/* ===================================================== 📸 GROUP CHAT IMAGE UPLOAD ===================================================== */ router.post("/group/image", auth, upload.single("image"), async (req, res) => { try { const { groupId } = req.body; const file = req.file;

if (!file) return res.status(400).json({ message: "No image uploaded" });

const imageUrl = await uploadToCloudinary(file.buffer);

const message = new Message({
  sender: req.userId,
  group: groupId,
  text: "",
  image: imageUrl,
});

await message.save();
await message.populate("sender", "username");

res.status(201).json(message);

} catch (err) { console.error("❌ Group upload error:", err); res.status(500).json({ error: "Upload failed" }); } });

/* ===================================================== 📸 PRIVATE CHAT MULTIPLE IMAGE UPLOAD ===================================================== */ // Private message send route router.post("/private/send", auth, async (req, res) => { try { const { recipientId, content } = req.body;

if (!recipientId || (!content && !req.file)) {
  return res.status(400).json({ error: "Message content or image is required." });
}

const newMessage = new Message({
  sender: req.userId,
  recipient: recipientId,
  content: content || "",
  status: "sent",
});

await newMessage.save();
await newMessage.populate("sender", "username");

// Emit via Socket.IO to recipient
req.io?.to(recipientId).emit("privateMessage", {
  senderId: req.userId,
  content,
  timestamp: newMessage.createdAt,
});

res.status(201).json(newMessage);

} catch (err) { console.error("Private message error:", err); res.status(500).json({ error: "Failed to send message" }); } });

/* ===================================================== 🕓 GET PRIVATE CHAT HISTORY ===================================================== */ router.get("/history/:receiverId", auth, async (req, res) => { try { const { receiverId } = req.params;

const messages = await Message.find({
  $or: [
    { sender: req.userId, recipient: receiverId },
    { sender: receiverId, recipient: req.userId },
  ],
}).sort({ createdAt: 1 });

res.status(200).json({ success: true, messages });

} catch (err) { console.error("Fetch history error:", err); res.status(500).json({ success: false, error: "Failed to fetch messages" }); } });

module.exports = router;

