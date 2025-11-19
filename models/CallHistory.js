// models/CallHistory.js
const mongoose = require("mongoose");

const callHistorySchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  participants: [{ type: String, required: true }], // array of user IDs
  type: { type: String, enum: ["voice", "video"], required: true },
  status: { type: String, enum: ["completed", "missed"], default: "completed" },
  duration: { type: Number, default: 0 }, // seconds
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model("CallHistory", callHistorySchema);
