const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    sender: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    receiver: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    content: { 
      type: String, 
      default: "" 
    },
    type: { 
      type: String, 
      enum: ["text", "image", "file"], 
      default: "text" 
    },
    fileUrl: { 
      type: String, 
      default: "" 
    },
    fileType: { 
      type: String, 
      default: "text" 
    },
    replyTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Message", 
      default: null 
    }, // supports replies
    isForwarded: { 
      type: Boolean, 
      default: false 
    }, // supports forwards
    status: { 
      type: String, 
      enum: ["sent", "delivered", "read"], 
      default: "sent" 
    }
  },
  { timestamps: true }
);

// ✅ Indexes for faster queries
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 }); // common chat query
MessageSchema.index({ receiver: 1, status: 1 }); // for unread message lookups
MessageSchema.index({ createdAt: -1 }); // quick sorting by time

module.exports = mongoose.model("Message", MessageSchema);