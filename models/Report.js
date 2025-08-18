// models/Report.js
import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  type: { type: String, enum: ["user","group","message"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reason: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Report", reportSchema);