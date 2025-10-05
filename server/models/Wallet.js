import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 5 }, // Each new user starts with $5
    creditExpiry: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months expiry
    },
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", walletSchema);