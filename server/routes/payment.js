import express from "express";
import Stripe from "stripe";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import SavedCard from "../models/SavedCard.js";
import Wallet from "../models/Wallet.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FLUTTERWAVE_SECRET = process.env.FLW_SECRET_KEY;

// ✅ Charge user’s default card instantly
router.post("/payment/charge-default", async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: "Missing parameters" });

    const card = await SavedCard.findOne({ uid, default: true });
    if (!card) return res.status(400).json({ message: "No default card found." });

    const idempotencyKey = uuidv4();
    let chargeResult;

    // 💳 Stripe flow
    if (card.gateway === "stripe") {
      const intent = await stripe.paymentIntents.create(
        {
          amount: Math.round(amount * 100),
          currency: "usd",
          customer: card.stripeCustomerId,
          payment_method: card.paymentMethodId,
          off_session: true,
          confirm: true,
        },
        { idempotencyKey }
      );

      chargeResult = { id: intent.id, status: intent.status, amount: amount };

      if (intent.status === "succeeded") {
        await Wallet.updateOne({ uid }, { $inc: { balance: amount } }, { upsert: true });
      }
    }

    // 💳 Paystack flow
    else if (card.gateway === "paystack") {
      const response = await axios.post(
        "https://api.paystack.co/transaction/charge_authorization",
        {
          authorization_code: card.authorizationCode,
          email: card.email,
          amount: Math.round(amount * 100),
        },
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        }
      );

      chargeResult = response.data.data;

      if (response.data.status && response.data.data.status === "success") {
        await Wallet.updateOne({ uid }, { $inc: { balance: amount } }, { upsert: true });
      }
    }

    // 💳 Flutterwave flow
    else if (card.gateway === "flutterwave") {
      const response = await axios.post(
        "https://api.flutterwave.com/v3/charges?type=card",
        {
          token: card.token,
          currency: "USD",
          amount,
          email: card.email,
        },
        {
          headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET}` },
        }
      );

      chargeResult = response.data.data;

      if (response.data.status === "success") {
        await Wallet.updateOne({ uid }, { $inc: { balance: amount } }, { upsert: true });
      }
    }

    res.json({ success: true, chargeResult });
  } catch (err) {
    console.error("Charge default card error:", err);
    res.status(500).json({ message: err.message || "Charge failed" });
  }
});

export default router;