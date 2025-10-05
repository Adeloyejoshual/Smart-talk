import express from "express";
import Stripe from "stripe";
import SavedCard from "../models/SavedCard.js";
import Wallet from "../models/Wallet.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Charge default saved card instantly
router.post("/payment/charge-default", async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount)
      return res.status(400).json({ message: "Missing parameters" });

    // 1️⃣ Find the user’s default card
    const card = await SavedCard.findOne({ uid, default: true });
    if (!card) return res.status(400).json({ message: "No default card found." });

    // 2️⃣ Create a PaymentIntent using the saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: "usd",
      customer: card.stripeCustomerId,
      payment_method: card.paymentMethodId,
      off_session: true,
      confirm: true,
    });

    // 3️⃣ Update user’s wallet
    const wallet = await Wallet.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { new: true, upsert: true }
    );

    // 4️⃣ Return confirmation
    res.json({
      success: true,
      message: "Charged successfully.",
      wallet,
      paymentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("❌ Charge default card error:", error);
    const message =
      error.code === "authentication_required"
        ? "Authentication required — please reauthorize your card."
        : error.message;
    res.status(500).json({ message });
  }
});

export default router;