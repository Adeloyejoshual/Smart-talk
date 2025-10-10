const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  userId: { type: String, ref: "User" },
  gateway: String,
  transactionId: String,
  amount: Number,
  currency: String,
  status: String,
  receiptUrl: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);