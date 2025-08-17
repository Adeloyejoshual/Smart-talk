// models/Wallet.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["credit","debit"], required: true },
  amount: { type: Number, required: true }, // stored in USD (float)
  currency: { type: String, default: "USD" },
  usdApprox: { type: Number, default: 0 },
  gateway: { type: String }, // paystack/flutterwave/stripe
  reference: { type: String },
  status: { type: String, enum: ["pending","success","failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  balanceUsd: { type: Number, default: 0.0 },
  currency: { type: String, default: "USD" }, // display preference
  lowBalanceThresholdUsd: { type: Number, default: 1.0 },
  transactions: [transactionSchema],
}, { timestamps: true });

module.exports = mongoose.model("Wallet", walletSchema);