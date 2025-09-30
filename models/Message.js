const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    senderEmail: { 
      type: String, 
      required: true 
    },
    receiverEmail: { 
      type: String, 
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

    // 🔹 Extra features
    replyTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Message", 
      default: null 
    }, // supports replies
    isForwarded: { 
      type: Boolean, 
      default: false 
    }, // supports forwards

    // 🔹 Delivery / read tracking
    status: { 
      type: String, 
      enum: ["sent", "delivered", "read"], 
      default: "sent" 
    }
  },
  { timestamps: true }
);

// ✅ Indexes for performance
MessageSchema.index({ senderEmail: 1, receiverEmail: 1, createdAt: -1 }); // get chat history fast
MessageSchema.index({ receiverEmail: 1, status: 1 }); // get unread messages fast
MessageSchema.index({ createdAt: -1 }); // quick sorting by time

module.exports = mongoose.model("Message", MessageSchema);