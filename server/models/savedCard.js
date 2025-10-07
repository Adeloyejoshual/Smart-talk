// 📁 /server/models/SavedCard.js
import mongoose from "mongoose";

const SavedCardSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true }, // user id
    gateway: { type: String, enum: ["stripe", "paystack", "flutterwave"], required: true },
    cardId: { type: String, required: true }, // Stripe/Paystack/FW ID
    details: {
      brand: String,
      last4: String,
      exp_month: String,
      exp_year: String,
    },
    default: { type: Boolean, default: false },
    stripeCustomerId: String,
    paymentMethodId: String,
  },
  { timestamps: true }
);

// Ensure only one default card per user
SavedCardSchema.index({ uid: 1, default: 1 });
SavedCardSchema.index({ uid: 1 });

export default mongoose.model("SavedCard", SavedCardSchema);
