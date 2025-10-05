import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import Wallet from "../models/Wallet.js";

const router = express.Router();

// Use raw body for Stripe signature verification
router.post(
  "/stripe-webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Handle successful payment session
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const uid = session.metadata?.uid;
      const amount = Number(session.metadata?.amount) || 0;

      if (uid && amount > 0) {
        try {
          const wallet = await Wallet.findOneAndUpdate(
            { uid },
            { $inc: { balance: amount } },
            { new: true, upsert: true }
          );
          console.log(`💰 Wallet credited for UID ${uid}: +$${amount}`);
        } catch (err) {
          console.error("⚠️ Error updating wallet:", err);
        }
      }
    }

    res.json({ received: true });
  }
);

export default router;
