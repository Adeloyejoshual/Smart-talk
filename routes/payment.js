const express = require("express");
const router = express.Router();
const axios = require("axios");
const Stripe = require("stripe");
const Wallet = require("../models/Wallet");
const verifyFirebaseToken = require("../middleware/authMiddleware");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ POST /api/payments/stripe/initiate
// Create Stripe PaymentIntent and return client secret
router.post("/stripe/initiate", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: "Amount required" });

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // USD cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error("Stripe Error:", err);
    res.status(500).json({ error: "Stripe initialization failed" });
  }
});

// ✅ POST /api/payments/stripe/confirm
// Called after frontend confirms Stripe payment
router.post("/stripe/confirm", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount) return res.status(400).json({ error: "Missing fields" });

    let wallet = await Wallet.findOne({ userId: uid });
    if (!wallet) wallet = await Wallet.create({ userId: uid, balance: 0 });

    wallet.balance += parseFloat(amount);
    await wallet.save();

    res.json({ message: "Wallet updated after Stripe payment", balance: wallet.balance });
  } catch (err) {
    console.error("Stripe Confirm Error:", err);
    res.status(500).json({ error: "Wallet update failed" });
  }
});


// ✅ POST /api/payments/paystack/initiate
router.post("/paystack/initiate", verifyFirebaseToken, async (req, res) => {
  try {
    const { email, amount } = req.body;
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email, amount: Math.round(amount * 100) },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    res.json({ authorization_url: response.data.data.authorization_url });
  } catch (err) {
    console.error("Paystack Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Paystack initiation failed" });
  }
});

// ✅ POST /api/payments/flutterwave/initiate
router.post("/flutterwave/initiate", verifyFirebaseToken, async (req, res) => {
  try {
    const { email, amount, uid } = req.body;
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: `flw-${Date.now()}`,
        amount,
        currency: "USD",
        redirect_url: `${process.env.BASE_URL}/api/payments/flutterwave/verify`,
        customer: { email },
        customizations: { title: "SmartTalk Wallet Top-up" },
      },
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    res.json({ link: response.data.data.link });
  } catch (err) {
    console.error("Flutterwave Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Flutterwave initiation failed" });
  }
});