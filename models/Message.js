// models/Message.js
const mongoose = require("mongoose");

const EmojiReactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  emoji: { type: String, required: true },
});

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    content: { type: String, default: "" },

    // File/Image support
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    image: { type: String, default: "" },
    file: { type: String, default: "" },
    fileType: { type: String, default: "" },

    // Reply / Forward
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    isForwarded: { type: Boolean, default: false },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Message actions
    isStarred: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },

    // Reactions
    emojiReactions: [EmojiReactionSchema],

    // Deleted messages
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Status
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);