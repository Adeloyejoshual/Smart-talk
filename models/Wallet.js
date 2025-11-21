import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  lastCheckIn: { type: String, default: null }, // "2025-11-21"
});

export default mongoose.model("Wallet", WalletSchema);