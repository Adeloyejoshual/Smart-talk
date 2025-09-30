const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    fileUrl: { type: String, default: "" },
    fileType: { type: String, default: "text" },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);