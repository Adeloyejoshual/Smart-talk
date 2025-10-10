import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  senderUid: { type: String, required: true },
  receiverUid: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: "text" }, // text, image, file, voice
  timestamp: { type: Date, default: Date.now },
  pinnedUntil: { type: Date, default: null }, // for pinned messages
  deletedFor: { type: [String], default: [] }, // list of UIDs who deleted it
});

export default mongoose.model("Message", messageSchema);