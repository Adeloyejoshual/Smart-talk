// /server/routes/payment.js
import express from "express";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";
import Wallet from "../models/Wallet.js"; // your wallet schema/model

dotenv.config();
const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 CREATE PAYMENT SESSION (handles Stripe, Paystack, Flutterwave)
router.post("/payment/session", async (req, res) => {
  try {
    const { amount, uid, method } = req.body;
    if (!amount || !uid) return res.status(400).json({ message: "Missing data" });

    let url = "";

    // ✅ STRIPE PAYMENT
    if (method === "stripe") {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "SmartTalk Wallet Credit" },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/wallet?success=true`,
        cancel_url: `${process.env.CLIENT_URL}/wallet?cancelled=true`,
        metadata: { uid },
      });
      url = session.url;
    }

    // ✅ PAYSTACK PAYMENT
    else if (method === "paystack") {
      const paystackRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          amount: Math.round(amount * 100), // kobo
          email: `${uid}@smarttalk.app`, // dummy email based on uid
          callback_url: `${process.env.CLIENT_URL}/wallet?success=true`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      url = paystackRes.data.data.authorization_url;
    }

    // ✅ FLUTTERWAVE PAYMENT
    else if (method === "flutterwave") {
      const flutterRes = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: `FLW-${Date.now()}`,
          amount,
          currency: "USD",
          redirect_url: `${process.env.CLIENT_URL}/wallet?success=true`,
          customer: {
            email: `${uid}@smarttalk.app`,
            name: "SmartTalk User",
          },
          customizations: {
            title: "SmartTalk Wallet Credit",
            description: "Add credit to SmartTalk Wallet",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      url = flutterRes.data.data.link;
    }

    res.json({ url });
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🟣 WEBHOOK (Stripe only for now, optional)
router.post("/payment/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("⚠️ Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.metadata.uid;
    const amount = session.amount_total / 100;

    // Update user's wallet
    await Wallet.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    );
  }

  res.json({ received: true });
});

export default router;