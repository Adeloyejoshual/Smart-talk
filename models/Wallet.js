const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: { type: String, ref: "User", required: true },
  balance: { type: Number, default: 5.0 },
  currency: { type: String, default: "USD" },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Wallet", walletSchema);