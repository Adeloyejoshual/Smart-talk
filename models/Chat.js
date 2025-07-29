const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema(
  {
    participants: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', ChatSchema);