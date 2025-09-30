const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  senderEmail: { type: String, required: true },
  receiverEmail: { type: String, required: true },
  content: { type: String, default: "" },
  fileUrl: { type: String, default: "" },
  fileType: { type: String, enum: ["text","image","file"], default: "text" },
  status: { type: String, enum: ["sent","delivered","read"], default: "sent" },
}, { timestamps: true });

MessageSchema.index({ senderEmail: 1, receiverEmail: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);