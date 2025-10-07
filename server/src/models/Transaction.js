import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  userId: String,
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: Number,
  reason: String,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Transaction", transactionSchema);