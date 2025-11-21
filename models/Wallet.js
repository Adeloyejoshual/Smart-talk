import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // User ID, unique per wallet
  balance: { type: Number, default: 0 },              // Current wallet balance
  lastCheckIn: { type: String, default: null },       // Date of last daily check-in (YYYY-MM-DD)
});

export default mongoose.model("Wallet", WalletSchema);