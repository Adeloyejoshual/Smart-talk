// /server/routes/payment.js
import express from "express";
import Stripe from "stripe";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import SavedCard from "../models/SavedCard.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

const router = express.Router();

// ✅ Initialize payment providers
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;

// ✅ Helper: get or create Stripe customer
async function getOrCreateStripeCustomer(uid) {
  let record = await User.findOne({ uid });
  if (record?.stripeCustomerId) return record.stripeCustomerId;

  const customer = await stripe.customers.create({ metadata: { uid } });
  await User.updateOne({ uid }, { stripeCustomerId: customer.id }, { upsert: true });
  return customer.id;
}

// ✅ Add credit to wallet
async function creditWallet(uid, amount) {
  const wallet = await Wallet.findOneAndUpdate(
    { uid },
    { $inc: { balance: amount } },
    { upsert: true, new: true }
  );
  return wallet;
}

//
// ─── STRIPE ──────────────────────────────────────────────
//
router.post("/payment/stripe-session", async (req, res) => {
  try {
    const { amount, uid } = req.body;
    if (!amount || !uid) return res.status(400).json({ message: "Missing parameters" });

    const customerId = await getOrCreateStripeCustomer(uid);
    const idempotencyKey = uuidv4();

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "Wallet Credit" },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/wallet/cancel`,
      },
      { idempotencyKey }
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ message: err.message });
  }
});

//
// ─── PAYSTACK ──────────────────────────────────────────────
//
router.post("/payment/paystack", async (req, res) => {
  try {
    const { amount, email, uid } = req.body;
    const r = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100, // in kobo
        callback_url: `${process.env.FRONTEND_URL}/wallet/verify/paystack?uid=${uid}`,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    res.json({ url: r.data.data.authorization_url });
  } catch (err) {
    console.error("Paystack init error:", err.response?.data || err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/payment/verify/paystack", async (req, res) => {
  try {
    const { reference, uid } = req.query;
    const verify = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    if (verify.data.data.status === "success") {
      const amount = verify.data.data.amount / 100;
      await creditWallet(uid, amount);
      return res.json({ success: true });
    }
    res.json({ success: false });
  } catch (err) {
    console.error("Paystack verify error:", err);
    res.status(500).json({ message: err.message });
  }
});

//
// ─── FLUTTERWAVE ──────────────────────────────────────────────
//
router.post("/payment/flutterwave", async (req, res) => {
  try {
    const { amount, email, uid } = req.body;

    const payload = {
      tx_ref: uuidv4(),
      amount,
      currency: "USD",
      redirect_url: `${process.env.FRONTEND_URL}/wallet/verify/flutterwave?uid=${uid}`,
      customer: { email },
      meta: { uid },
    };

    const r = await axios.post("https://api.flutterwave.com/v3/payments", payload, {
      headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET}` },
    });

    res.json({ url: r.data.data.link });
  } catch (err) {
    console.error("Flutterwave init error:", err.response?.data || err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/payment/verify/flutterwave", async (req, res) => {
  try {
    const { transaction_id, uid } = req.query;
    const verify = await axios.get(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET}` },
    });

    if (verify.data.data.status === "successful") {
      const amount = Number(verify.data.data.amount);
      await creditWallet(uid, amount);
      return res.json({ success: true });
    }
    res.json({ success: false });
  } catch (err) {
    console.error("Flutterwave verify error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;