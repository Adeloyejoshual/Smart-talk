const mongoose = require("mongoose");

const adminMessageSchema = new mongoose.Schema({
  title: String,
  message: String,
  priority: { type: String, default: "info" },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
});

module.exports = mongoose.model("AdminMessage", adminMessageSchema);