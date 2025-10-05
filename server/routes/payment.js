import express from "express";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Create Stripe Checkout Session
router.post("/payment/stripe-session", async (req, res) => {
  try {
    const { amount, uid } = req.body;

    if (!uid || !amount || amount <= 0)
      return res.status(400).json({ message: "Invalid payment details." });

    // Stripe expects amount in cents (e.g. $5 = 500)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "SmartTalk Wallet Credit" },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/wallet?success=true`,
      cancel_url: `${process.env.CLIENT_URL}/wallet?cancelled=true`,
      metadata: { uid, amount },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe Session Error:", err.message);
    res.status(500).json({ message: "Unable to create Stripe session." });
  }
});

export default router;
