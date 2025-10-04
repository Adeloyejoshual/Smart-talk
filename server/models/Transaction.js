import mongoose from "mongoose";

const txSchema = new mongoose.Schema({
  uid: { type: String, required: true }, // user who triggered the tx (sender or top-up)
  type: { type: String, enum: ["add","send","receive","bonus"], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: process.env.DEFAULT_CURRENCY || "USD" },
  meta: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Transaction", txSchema);