// models/Message.js

const mongoose = require('mongoose');

// Define message schema
const messageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Export the model
module.exports = mongoose.model('Message', messageSchema);
