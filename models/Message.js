const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" },
  fileUrl: { type: String, default: null },
  fileType: { type: String, enum: ["image", "file", "audio", "video", null], default: null },
  type: { type: String, enum: ["text", "file", "image"], default: "text" },
  attachmentUrl: { type: String, default: "" },
  status: { type: String, enum: ["sent", "read"], default: "sent" },
  read: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);