// server/models/CallSession.js
import mongoose from "mongoose";

const callSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  hostUid: { type: String, required: true },       // who is billed (host)
  participants: { type: [String], default: [] },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 },
  billedAmount: { type: Number, default: 0 },
  billed: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model("CallSession", callSessionSchema);
