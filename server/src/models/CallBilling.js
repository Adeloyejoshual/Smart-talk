import mongoose from "mongoose";

const callBillingSchema = new mongoose.Schema({
  callerId: String,
  calleeId: String,
  duration: Number,
  totalCost: Number,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("CallBilling", callBillingSchema);