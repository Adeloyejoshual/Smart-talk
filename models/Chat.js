// models/Chat.js
const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  participants: {
    type: [String], // usernames or user IDs
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);