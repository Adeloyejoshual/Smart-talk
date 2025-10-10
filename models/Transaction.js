const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { type: String, ref: "User", required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["credit", "debit"], required: true },
  method: { type: String, enum: ["stripe", "paystack", "flutterwave"], required: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  reference: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", transactionSchema);