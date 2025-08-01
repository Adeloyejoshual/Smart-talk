// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);