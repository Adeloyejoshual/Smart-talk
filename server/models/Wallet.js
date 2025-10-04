import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  balance: { type: Number, default: Number(process.env.NEW_USER_BONUS || 5) },
  currency: { type: String, default: process.env.DEFAULT_CURRENCY || "USD" },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

export default mongoose.model("Wallet", walletSchema);