import mongoose from "mongoose";

const CallHistorySchema = new mongoose.Schema({
  callerId: { type: String, required: true },        // user who starts call
  receiverId: { type: String, required: true },      // user receiving call
  callType: { type: String, enum: ["audio", "video"], required: true },
  status: { type: String, enum: ["incoming", "outgoing", "missed", "ended"], default: "ended" },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  duration: { type: Number, default: 0 },            // seconds
}, { timestamps: true });

export default mongoose.model("CallHistory", CallHistorySchema);
