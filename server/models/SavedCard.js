import mongoose from "mongoose";

const SavedCardSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  gateway: { type: String, enum: ["stripe", "paystack", "flutterwave"], required: true },
  brand: String,
  last4: String,
  exp_month: Number,
  exp_year: Number,
  stripeCustomerId: String,
  paymentMethodId: String,
  paystackAuthCode: String,
  flwCardToken: String,
  default: { type: Boolean, default: false },
}, { timestamps: true });

SavedCardSchema.index({ uid: 1, default: 1 }); // ✅ for quick lookup of default card

export default mongoose.model("SavedCard", SavedCardSchema);