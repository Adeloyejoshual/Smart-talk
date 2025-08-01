// models/Chat.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Message", chatSchema);