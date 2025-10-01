const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  senderEmail: { type: String, required: true },
  senderUsername: { type: String, required: true },
  receiverEmail: { type: String, required: true },
  receiverUsername: { type: String, required: true },
  content: { type: String, default: "" },
  fileUrl: { type: String, default: "" },
  fileType: { type: String, enum: ["text", "image", "file"], default: "text" },
  messageType: { type: String, enum: ["text", "image", "video", "audio"], default: "text" },
  status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
  deletedAt: { type: Date },
  editedAt: { type: Date },
}, { timestamps: true });

MessageSchema.index({ senderEmail: 1, receiverEmail: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema); 