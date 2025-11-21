import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    type: { type: String, required: true }, // deposit, withdraw, checkin
    amount: { type: Number, required: true },
    status: { type: String, default: "success" }, // pending, failed, success
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", TransactionSchema);