const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  from: { type: String, required: true }, // store sender username
  to: { type: String, required: true },   // store receiver username
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', ChatSchema);