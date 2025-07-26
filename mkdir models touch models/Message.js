// models/Message.js

const mongoose = require('mongoose');

// Schema defines how each message is structured in the database
const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Export the model so it can be used in other files
module.exports = mongoose.model('Message', messageSchema);
