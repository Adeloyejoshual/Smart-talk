// models/Chat.js
const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

module.exports = mongoose.model('Chat', ChatSchema);