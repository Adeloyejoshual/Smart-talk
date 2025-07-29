// models/Chat.js
const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  participants: {
    type: [String], // [userId1, userId2]
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);