import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ["deposit", "withdraw", "checkin"] },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Success" },
    description: { type: String },
    balanceAfter: { type: Number },  // optional: store balance after txn
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", TransactionSchema);